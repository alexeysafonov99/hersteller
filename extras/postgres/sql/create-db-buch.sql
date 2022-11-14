-- Copyright (C) 2022 - present Juergen Zimmermann, Hochschule Karlsruhe
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.
--
-- This program is distributed in the hope that it will be useful,
-- but WITHOUT ANY WARRANTY; without even the implied warranty of
-- MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
-- GNU General Public License for more details.
--
-- You should have received a copy of the GNU General Public License
-- along with this program.  If not, see <https://www.gnu.org/licenses/>.

-- (1) PostgreSQL NICHT als user "postgres" starten, sondern implizit als "root"
--     d.h. auskommentieren in docker-compose.yaml
-- (2) docker compose exec postgres bash
-- (3) chown postgres:postgres /var/lib/postgresql/tablespace
-- (4) chown postgres:postgres /var/lib/postgresql/tablespace/buch
-- (5) exit
-- (6) docker compose down
-- (7) in docker-compose.yaml den User "postgres" wieder aktivieren
-- (8) docker compose up
-- (9) docker compose exec postgres bash
-- (10) psql --dbname=postgres --username=postgres --file=/sql/create-db-buch.sql
-- (11) exit

-- https://www.postgresql.org/docs/current/sql-createrole.html
CREATE ROLE buch LOGIN PASSWORD 'p';

-- https://www.postgresql.org/docs/current/sql-createdatabase.html
CREATE DATABASE buch;

GRANT ALL ON DATABASE buch TO buch;

-- https://www.postgresql.org/docs/10/sql-createtablespace.html
CREATE TABLESPACE buchspace OWNER buch LOCATION '/var/lib/postgresql/tablespace/buch';
