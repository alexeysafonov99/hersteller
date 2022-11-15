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
import { Args, Query, Resolver } from '@nestjs/graphql';
import { UseGuards, UseInterceptors } from '@nestjs/common';
import { getLogger } from '../../logger/logger.js';
// eslint-disable-next-line sort-imports
import { type Hersteller } from '../entity/hersteller.entity.js';
import { HerstellerReadService } from '../service/hersteller-read.service.js';
import { JwtAuthGraphQlGuard } from '../../security/auth/jwt/jwt-auth-graphql.guard.js';
import { ResponseTimeInterceptor } from '../../logger/response-time.interceptor.js';
import { RolesGraphQlGuard } from '../../security/auth/roles/roles-graphql.guard.js';
import { UserInputError } from 'apollo-server-express';

export type HerstellerDTO = Omit<Hersteller, 'aktualisiert' | 'erzeugt'>;
export interface IdInput {
    id: string;
}

@Resolver()
@UseGuards(JwtAuthGraphQlGuard, RolesGraphQlGuard)
@UseInterceptors(ResponseTimeInterceptor)
export class HerstellerQueryResolver {
    readonly #service: HerstellerReadService;

    readonly #logger = getLogger(HerstellerQueryResolver.name);

    constructor(service: HerstellerReadService) {
        this.#service = service;
    }

    @Query('hersteller')
    async findById(@Args() id: IdInput) {
        const idStr = id.id;
        this.#logger.debug('findById: id=%s', idStr);

        const hersteller = await this.#service.findById(idStr);
        if (hersteller === undefined) {
            // UserInputError liefert Statuscode 200
            // Weitere Error-Klasse in apollo-server-errors:
            // SyntaxError, ValidationError, AuthenticationError, ForbiddenError,
            // PersistedQuery, PersistedQuery
            // https://www.apollographql.com/blog/graphql/error-handling/full-stack-error-handling-with-graphql-apollo
            throw new UserInputError(
                `Es wurde kein Hersteller mit der ID ${idStr} gefunden.`,
            );
        }
        const herstellerDTO = this.#toHerstellerDTO(hersteller);
        this.#logger.debug('findById: herstellerDTO=%o', herstellerDTO);
        return herstellerDTO;
    }

    @Query('herstellers')
    async find(@Args() name: { name: string } | undefined) {
        const nameStr = name?.name;
        this.#logger.debug('find: name=%s', nameStr);
        const suchkriterium = nameStr === undefined ? {} : { name: nameStr };
        const herstellers = await this.#service.find(suchkriterium);
        if (herstellers.length === 0) {
            // UserInputError liefert Statuscode 200
            throw new UserInputError('Es wurden keine Hersteller gefunden.');
        }

        const herstellersDTO = herstellers.map((hersteller) =>
            this.#toHerstellerDTO(hersteller),
        );
        this.#logger.debug('find: herstellersDTO=%o', herstellersDTO);
        return herstellersDTO;
    }

    #toHerstellerDTO(hersteller: Hersteller) {
        const herstellerDTO: HerstellerDTO = {
            id: hersteller.id,
            telefon: hersteller.telefon,
            version: hersteller.version,
            name: hersteller.name,
            homepage: hersteller.homepage,
        };
        return herstellerDTO;
    }
}
