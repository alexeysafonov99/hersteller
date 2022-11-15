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
import { AuthModule } from '../security/auth/auth.module.js';
import { Hersteller } from './entity/hersteller.entity.js';
import { HerstellerGetController } from './rest/hersteller-get.controller.js';
import { HerstellerMutationResolver } from './graphql/hersteller-mutation.resolver.js';
import { HerstellerQueryResolver } from './graphql/hersteller-query.resolver.js';
import { HerstellerReadService } from './service/hersteller-read.service.js';
import { HerstellerValidationService } from './service/hersteller-validation.service.js';
import { HerstellerWriteController } from './rest/hersteller-write.controller.js';
import { HerstellerWriteService } from './service/hersteller-write.service.js';
import { MailModule } from '../mail/mail.module.js';
import { Module } from '@nestjs/common';
import { QueryBuilder } from './service/query-builder.js';
import { TypeOrmModule } from '@nestjs/typeorm';

/**
 * Das Modul besteht aus Controller- und Service-Klassen für die Verwaltung von
 * Herstellern.
 * @packageDocumentation
 */

/**
 * Die dekorierte Modul-Klasse mit Controller- und Service-Klassen sowie der
 * Funktionalität für TypeORM.
 */
@Module({
    imports: [
        MailModule,
        // siehe auch src\app.module.ts
        TypeOrmModule.forFeature([Hersteller]),
        AuthModule,
    ],
    controllers: [HerstellerGetController, HerstellerWriteController],
    // Provider sind z.B. Service-Klassen fuer DI
    providers: [
        HerstellerReadService,
        HerstellerWriteService,
        HerstellerValidationService,
        HerstellerQueryResolver,
        HerstellerMutationResolver,
        QueryBuilder,
    ],
    // Export der Provider fuer DI in anderen Modulen
    exports: [
        HerstellerReadService,
        HerstellerWriteService,
        HerstellerValidationService,
    ],
})
export class HerstellerModule {}
