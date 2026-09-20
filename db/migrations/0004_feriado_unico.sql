--> statement-breakpoint
DELETE FROM "feriados" a USING "feriados" b
 WHERE a.ctid > b.ctid
   AND a."data" = b."data"
   AND a."abrangencia" = b."abrangencia"
   AND coalesce(a."uf", '') = coalesce(b."uf", '')
   AND coalesce(lower(a."municipio"), '') = coalesce(lower(b."municipio"), '');
--> statement-breakpoint
CREATE UNIQUE INDEX "feriados_unico" ON "feriados" USING btree ("data","abrangencia",coalesce("uf", ''),coalesce(lower("municipio"), ''));
