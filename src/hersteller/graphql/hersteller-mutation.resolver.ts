/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable sort-imports */
/*
 * Copyright (C) 2021 - present Juergen Zimmermann, Hochschule Karlsruhe
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
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { type CreateError, type UpdateError } from '../service/errors.js';
import { UseInterceptors } from '@nestjs/common';
import { type Hersteller } from '../entity/hersteller.entity.js';
import { HerstellerWriteService } from '../service/hersteller-write.service.js';
import { type IdInput } from './hersteller-query.resolver.js';
import { ResponseTimeInterceptor } from '../../logger/response-time.interceptor.js';
import { Roles } from '../../security/auth/roles/roles.decorator.js';
import { UserInputError } from 'apollo-server-express';
import { getLogger } from '../../logger/logger.js';

type HerstellerCreateDTO = Omit<
    Hersteller,
    'aktualisiert' | 'erzeugt' | 'id' | 'version'
>;

type HerstellerUpdateDTO = Omit<Hersteller, 'aktualisiert' | 'erzeugt'>;

@Resolver()
@UseInterceptors(ResponseTimeInterceptor)
export class HerstellerMutationResolver {
    readonly #service: HerstellerWriteService;

    readonly #logger = getLogger(HerstellerMutationResolver.name);

    constructor(service: HerstellerWriteService) {
        this.#service = service;
    }

    @Mutation()
    @Roles('admin', 'mitarbeiter')
    async create(@Args('input') herstellerDTO: HerstellerCreateDTO) {
        this.#logger.debug('create: herstellerDTO=%o', herstellerDTO);

        const result = await this.#service.create(
            this.#dtoToHersteller(herstellerDTO),
        );
        this.#logger.debug('createBuch: result=%o', result);

        if (Object.prototype.hasOwnProperty.call(result, 'type')) {
            // UserInputError liefert Statuscode 200
            throw new UserInputError(
                this.#errorMsgCreateHersteller(result as CreateError),
            );
        }
        return result;
    }

    @Mutation()
    @Roles('admin', 'mitarbeiter')
    async update(@Args('input') hersteller: HerstellerUpdateDTO) {
        this.#logger.debug('update: hersteller=%o', hersteller);
        const versionStr = `"${hersteller.version?.toString()}"`;

        const result = await this.#service.update(
            hersteller.id,
            hersteller as Hersteller,
            versionStr,
        );
        if (typeof result === 'object') {
            throw new UserInputError(this.#errorMsgUpdateHersteller(result));
        }
        this.#logger.debug('updateHersteller: result=%d', result);
        return result;
    }

    @Mutation()
    @Roles('admin')
    async delete(@Args() id: IdInput) {
        const idStr = id.id;
        this.#logger.debug('delete: id=%s', idStr);
        const result = await this.#service.delete(idStr);
        this.#logger.debug('deleteHersteller: result=%s', result);
        return result;
    }

    #dtoToHersteller(herstellerDTO: HerstellerCreateDTO): Hersteller {
        const hersteller: Hersteller = {
            id: undefined,
            version: undefined,
            name: herstellerDTO.name,
            telefon: herstellerDTO.telefon,
            homepage: herstellerDTO.homepage,
            erzeugt: undefined,
            aktualisiert: undefined,
        };

        return hersteller;
    }

    #errorMsgCreateHersteller(err: CreateError) {
        switch (err.type) {
            case 'ConstraintViolations': {
                return err.messages.join(' ');
            }
            case 'NameExists': {
                return `Der Name "${err.name}" existiert bereits`;
            }
            default: {
                return 'Unbekannter Fehler';
            }
        }
    }

    #errorMsgUpdateHersteller(err: UpdateError) {
        switch (err.type) {
            case 'ConstraintViolations': {
                return err.messages.join(' ');
            }
            case 'NameExists': {
                return `Der Name "${err.name}" existiert bereits`;
            }
            case 'HerstellerNotExists': {
                return `Es gibt keinen Hersteller mit der ID ${err.id}`;
            }
            case 'VersionInvalid': {
                return `"${err.version}" ist keine gueltige Versionsnummer`;
            }
            case 'VersionOutdated': {
                return `Die Versionsnummer "${err.version}" ist nicht mehr aktuell`;
            }
            default: {
                return 'Unbekannter Fehler';
            }
        }
    }
}
