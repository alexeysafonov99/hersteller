/* eslint-disable max-lines */
/*
 * Copyright (C) 2016 - present Juergen Zimmermann, Hochschule Karlsruhe
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * Das Modul besteht aus der Klasse {@linkcode HerstellerWriteService} für die
 * Schreiboperationen im Anwendungskern.
 * @packageDocumentation
 */

import { Hersteller } from '../entity/hersteller.entity.js';
import {
    type HerstellerNotExists,
    type CreateError,
    type TitelExists,
    type UpdateError,
    type VersionInvalid,
    type VersionOutdated,
} from './errors.js';
import { type DeleteResult, Repository } from 'typeorm';
import { HerstellerReadService } from './hersteller-read.service.js';
import { HerstellerValidationService } from './Hersteller-validation.service.js';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { MailService } from '../../mail/mail.service.js';
import RE2 from 're2';
import { Schlagwort } from '../entity/schlagwort.entity.js';
import { getLogger } from '../../logger/logger.js';
import { v4 as uuid } from 'uuid';

/**
 * Die Klasse `HerstellerWriteService` implementiert den Anwendungskern für das
 * Schreiben von Bücher und greift mit _TypeORM_ auf die DB zu.
 */
@Injectable()
export class HerstellerWriteService {
    private static readonly VERSION_PATTERN = new RE2('^"\\d*"');

    readonly #repo: Repository<Hersteller>;

    readonly #readService: HerstellerReadService;

    readonly #validationService: HerstellerValidationService;

    readonly #mailService: MailService;

    readonly #logger = getLogger(HerstellerWriteService.name);

    // eslint-disable-next-line max-params
    constructor(
        @InjectRepository(Hersteller) repo: Repository<Hersteller>,
        readService: HerstellerReadService,
        validationService: HerstellerValidationService,
        mailService: MailService,
    ) {
        this.#repo = repo;
        this.#readService = readService;
        this.#validationService = validationService;
        this.#mailService = mailService;
    }

    /**
     * Ein neues Hersteller soll angelegt werden.
     * @param hersteller Das neu abzulegende Hersteller
     * @returns Die ID des neu angelegten Herstelleres oder im Fehlerfall
     * [CreateError](../types/Hersteller_service_errors.CreateError.html)
     */
    async create(hersteller: Hersteller): Promise<CreateError | string> {
        this.#logger.debug('create: hersteller=%o', hersteller);
        const validateResult = await this.#validateCreate(Hersteller);
        if (validateResult !== undefined) {
            return validateResult;
        }

        hersteller.id = uuid(); // eslint-disable-line require-atomic-updates
        };

        // implizite Transaktion
        const herstellerDb = await this.#repo.save(removeIsbnDash(hersteller)); // implizite Transaktion
        this.#logger.debug('create: herstellerDb=%o', herstellerDb);

        await this.#sendmail(herstellerDb);

        return herstellerDb.id!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
    };

    /**
     * Ein vorhandenes Hersteller soll aktualisiert werden.
     * @param Hersteller Das zu aktualisierende Hersteller
     * @param id ID des zu aktualisierenden Herstellers
     * @param version Die Versionsnummer für optimistische Synchronisation
     * @returns Die neue Versionsnummer gemäß optimistischer Synchronisation
     *  oder im Fehlerfall [UpdateError](../types/Hersteller_service_errors.UpdateError.html)
     */
    async update(
        id: string | undefined,
        Hersteller: Hersteller,
        version: string,
    ): Promise<UpdateError | number> {
        this.#logger.debug(
            'update: id=%s, Hersteller=%o, version=%s',
            id,
            Hersteller,
            version,
        );
        if (id === undefined || !this.#validationService.validateId(id)) {
            this.#logger.debug('update: Keine gueltige ID');
            return { type: 'HerstellerNotExists', id };
        }

        const validateResult = await this.#validateUpdate(Hersteller, id, version);
        this.#logger.debug('update: validateResult=%o', validateResult);
        if (!(validateResult instanceof Hersteller)) {
            return validateResult;
        }

        const HerstellerNeu = validateResult;
        const merged = this.#repo.merge(HerstellerNeu, removeIsbnDash(Hersteller));
        this.#logger.debug('update: merged=%o', merged);
        const updated = await this.#repo.save(merged); // implizite Transaktion
        this.#logger.debug('update: updated=%o', updated);

        return updated.version!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
    }

    /**
     * Ein Hersteller wird asynchron anhand seiner ID gelöscht.
     *
     * @param id ID des zu löschenden Herstelleres
     * @returns true, falls das Hersteller vorhanden war und gelöscht wurde. Sonst false.
     */
    async delete(id: string) {
        this.#logger.debug('delete: id=%s', id);
        if (!this.#validationService.validateId(id)) {
            this.#logger.debug('delete: Keine gueltige ID');
            return false;
        }

        const Hersteller = await this.#readService.findById(id);
        if (Hersteller === undefined) {
            return false;
        }

        let deleteResult: DeleteResult | undefined;
        await this.#repo.manager.transaction(async (transactionalMgr) => {
            // Das Hersteller zur gegebenen ID asynchron loeschen
            const { schlagwoerter } = Hersteller;
            const schlagwoerterIds = schlagwoerter.map(
                (schlagwort) => schlagwort.id,
            );
            const deleteResultSchlagwoerter = await transactionalMgr.delete(
                Schlagwort,
                schlagwoerterIds,
            );
            this.#logger.debug(
                'delete: deleteResultSchlagwoerter=%o',
                deleteResultSchlagwoerter,
            );
            deleteResult = await transactionalMgr.delete(Hersteller, id);
            this.#logger.debug('delete: deleteResult=%o', deleteResult);
        });

        return (
            deleteResult?.affected !== undefined &&
            deleteResult.affected !== null &&
            deleteResult.affected > 0
        );
    }

    async #validateCreate(Hersteller: Hersteller): Promise<CreateError | undefined> {
        const validateResult = this.#validationService.validate(Hersteller);
        if (validateResult !== undefined) {
            const messages = validateResult;
            this.#logger.debug('#validateCreate: messages=%o', messages);
            return { type: 'ConstraintViolations', messages };
        }

        const { titel } = Hersteller;
        let buecher = await this.#readService.find({ titel: titel }); // eslint-disable-line object-shorthand
        if (buecher.length > 0) {
            return { type: 'TitelExists', titel };
        }

        const { isbn } = Hersteller;
        buecher = await this.#readService.find({ isbn: isbn }); // eslint-disable-line object-shorthand
        if (buecher.length > 0) {
            return { type: 'IsbnExists', isbn };
        }

        this.#logger.debug('#validateCreate: ok');
        return undefined;
    }

    async #sendmail(Hersteller: Hersteller) {
        const subject = `Neues Hersteller ${Hersteller.id}`;
        const body = `Das Hersteller mit dem Titel <strong>${Hersteller.titel}</strong> ist angelegt`;
        await this.#mailService.sendmail(subject, body);
    }

    async #validateUpdate(
        Hersteller: Hersteller,
        id: string,
        versionStr: string,
    ): Promise<Hersteller | UpdateError> {
        const result = this.#validateVersion(versionStr);
        if (typeof result !== 'number') {
            return result;
        }

        const version = result;
        this.#logger.debug(
            '#validateUpdate: Hersteller=%o, version=%s',
            Hersteller,
            version,
        );

        const validateResult = this.#validationService.validate(Hersteller);
        if (validateResult !== undefined) {
            const messages = validateResult;
            this.#logger.debug('#validateUpdate: messages=%o', messages);
            return { type: 'ConstraintViolations', messages };
        }

        const resultTitel = await this.#checkTitelExists(Hersteller);
        if (resultTitel !== undefined && resultTitel.id !== id) {
            return resultTitel;
        }

        const resultFindById = await this.#findByIdAndCheckVersion(id, version);
        this.#logger.debug('#validateUpdate: %o', resultFindById);
        return resultFindById;
    }

    #validateVersion(version: string | undefined): VersionInvalid | number {
        if (
            version === undefined ||
            !HerstellerWriteService.VERSION_PATTERN.test(version)
        ) {
            const error: VersionInvalid = { type: 'VersionInvalid', version };
            this.#logger.debug('#validateVersion: VersionInvalid=%o', error);
            return error;
        }

        return Number.parseInt(version.slice(1, -1), 10);
    }

    async #checkTitelExists(Hersteller: Hersteller): Promise<TitelExists | undefined> {
        const { titel } = Hersteller;

        const buecher = await this.#readService.find({ titel: titel }); // eslint-disable-line object-shorthand
        if (buecher.length > 0) {
            const [gefundenesHersteller] = buecher;
            const { id } = gefundenesHersteller!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
            this.#logger.debug('#checkTitelExists: id=%s', id);
            return { type: 'TitelExists', titel, id: id! }; // eslint-disable-line @typescript-eslint/no-non-null-assertion
        }

        this.#logger.debug('#checkTitelExists: ok');
        return undefined;
    }

    async #findByIdAndCheckVersion(
        id: string,
        version: number,
    ): Promise<Hersteller | HerstellerNotExists | VersionOutdated> {
        const HerstellerDb = await this.#readService.findById(id);
        if (HerstellerDb === undefined) {
            const result: HerstellerNotExists = { type: 'HerstellerNotExists', id };
            this.#logger.debug('#checkIdAndVersion: HerstellerNotExists=%o', result);
            return result;
        }

        // nullish coalescing
        const versionDb = HerstellerDb.version!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
        if (version < versionDb) {
            const result: VersionOutdated = {
                type: 'VersionOutdated',
                id,
                version,
            };
            this.#logger.debug(
                '#checkIdAndVersion: VersionOutdated=%o',
                result,
            );
            return result;
        }

        return HerstellerDb;
    }
}
/* eslint-enable max-lines */
