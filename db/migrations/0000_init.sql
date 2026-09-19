CREATE TABLE "avaliacao_acoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"avaliacao_id" uuid NOT NULL,
	"ordem" integer,
	"acao" text NOT NULL,
	"como" text,
	"responsavel" text,
	"prazo" date,
	"status" text DEFAULT 'aberta' NOT NULL,
	CONSTRAINT "avaliacao_acoes_status_check" CHECK ("avaliacao_acoes"."status" IN ('aberta','concluida','cancelada'))
);
--> statement-breakpoint
CREATE TABLE "avaliacao_competencias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"modelo_id" uuid NOT NULL,
	"ordem" integer NOT NULL,
	"nome" text NOT NULL,
	"peso" numeric(4, 3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "avaliacao_criterios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competencia_id" uuid NOT NULL,
	"codigo" text NOT NULL,
	"descricao" text NOT NULL,
	"indicador_auto" text,
	"ordem" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "avaliacao_modelos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"versao" text NOT NULL,
	"vigente" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "avaliacao_notas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"avaliacao_id" uuid NOT NULL,
	"criterio_id" uuid NOT NULL,
	"nota" integer,
	"comentario" text,
	CONSTRAINT "avaliacao_notas_nota_check" CHECK ("avaliacao_notas"."nota" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE "avaliacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"modelo_id" uuid NOT NULL,
	"supervisor_id" uuid NOT NULL,
	"avaliador_id" uuid NOT NULL,
	"periodo_inicio" date NOT NULL,
	"periodo_fim" date NOT NULL,
	"data_avaliacao" date,
	"nota_final" numeric(4, 2),
	"aproveitamento" numeric(5, 2),
	"classificacao" text,
	"pontos_fortes" text,
	"pontos_atencao" text,
	"status" text DEFAULT 'rascunho' NOT NULL,
	"finalizada_em" timestamp with time zone,
	CONSTRAINT "avaliacoes_status_check" CHECK ("avaliacoes"."status" IN ('rascunho','finalizada','assinada'))
);
--> statement-breakpoint
CREATE TABLE "carteira" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contrato_id" uuid NOT NULL,
	"supervisor_id" uuid NOT NULL,
	"inicio" date NOT NULL,
	"fim" date,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contatos_contrato" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contrato_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"cargo" text,
	"telefone" text,
	"email" text,
	"principal" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contratos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"endereco" text NOT NULL,
	"bairro" text,
	"cidade" text,
	"uf" char(2),
	"periodicidade" text NOT NULL,
	"escopo" text[],
	"observacoes" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contratos_periodicidade_check" CHECK ("contratos"."periodicidade" IN ('SEMANAL','2X NA SEMANA','QUINZENAL','MENSAL'))
);
--> statement-breakpoint
CREATE TABLE "demandas_extras" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"criado_por" uuid NOT NULL,
	"supervisor_id" uuid NOT NULL,
	"contrato_id" uuid,
	"descricao" text NOT NULL,
	"data_alvo" date,
	"prioridade" text,
	"status" text DEFAULT 'aberta' NOT NULL,
	"lida_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "demandas_extras_prioridade_check" CHECK ("demandas_extras"."prioridade" IN ('normal','alta','urgente')),
	CONSTRAINT "demandas_extras_status_check" CHECK ("demandas_extras"."status" IN ('aberta','concluida','cancelada'))
);
--> statement-breakpoint
CREATE TABLE "evidencias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visita_id" uuid,
	"plano_id" uuid,
	"atualizacao_id" uuid,
	"arquivo_url" text NOT NULL,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"precisao_m" numeric(6, 1),
	"capturado_em" timestamp with time zone NOT NULL,
	CONSTRAINT "evidencia_tem_dono" CHECK ("evidencias"."visita_id" IS NOT NULL OR "evidencias"."plano_id" IS NOT NULL OR "evidencias"."atualizacao_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "feriados" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"data" date NOT NULL,
	"descricao" text NOT NULL,
	"abrangencia" text NOT NULL,
	"uf" char(2),
	"municipio" text,
	CONSTRAINT "feriados_abrangencia_check" CHECK ("feriados"."abrangencia" IN ('nacional','estadual','municipal'))
);
--> statement-breakpoint
CREATE TABLE "motivos_cancelamento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"descricao" text NOT NULL,
	"categoria" text,
	"exige_texto" boolean DEFAULT false NOT NULL,
	"ordem" integer,
	"ativo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "obrigacao_ocorrencias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"obrigacao_id" uuid NOT NULL,
	"supervisor_id" uuid NOT NULL,
	"contrato_id" uuid,
	"competencia" date NOT NULL,
	"prazo" date NOT NULL,
	"status" text DEFAULT 'pendente' NOT NULL,
	"data_entrega" date,
	"dias_atendidos" integer,
	"dias_uteis" integer,
	"observacao" text,
	"marcado_por" uuid,
	"marcado_em" timestamp with time zone,
	CONSTRAINT "obrigacao_ocorrencias_status_check" CHECK ("obrigacao_ocorrencias"."status" IN ('pendente','atendido','atendido_atraso','nao_atendido','nao_aplicavel'))
);
--> statement-breakpoint
CREATE TABLE "obrigacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"recorrencia" text NOT NULL,
	"dia_limite" integer,
	"dia_semana" integer,
	"escopo" text DEFAULT 'supervisor' NOT NULL,
	"automatica" boolean DEFAULT false NOT NULL,
	"ordem" integer,
	"ativo" boolean DEFAULT true NOT NULL,
	CONSTRAINT "obrigacoes_recorrencia_check" CHECK ("obrigacoes"."recorrencia" IN ('mensal','semanal','diaria')),
	CONSTRAINT "obrigacoes_escopo_check" CHECK ("obrigacoes"."escopo" IN ('supervisor','contrato'))
);
--> statement-breakpoint
CREATE TABLE "plano_atualizacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plano_id" uuid NOT NULL,
	"visita_id" uuid,
	"autor_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"texto" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plano_atualizacoes_tipo_check" CHECK ("plano_atualizacoes"."tipo" IN ('acompanhamento','edicao','resolucao','reabertura','cancelamento'))
);
--> statement-breakpoint
CREATE TABLE "planos_acao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contrato_id" uuid NOT NULL,
	"visita_origem_id" uuid,
	"aberto_por" uuid NOT NULL,
	"descricao" text NOT NULL,
	"local_setor" text,
	"prioridade" text DEFAULT 'normal' NOT NULL,
	"prazo" date,
	"responsavel" text,
	"status" text DEFAULT 'aberto' NOT NULL,
	"resolvido_em" timestamp with time zone,
	"resolvido_por" uuid,
	"motivo_cancelamento" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "planos_acao_prioridade_check" CHECK ("planos_acao"."prioridade" IN ('baixa','normal','alta','critica')),
	CONSTRAINT "planos_acao_status_check" CHECK ("planos_acao"."status" IN ('aberto','em_andamento','resolvido','cancelado'))
);
--> statement-breakpoint
CREATE TABLE "programacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supervisor_id" uuid NOT NULL,
	"semana_inicio" date NOT NULL,
	"semana_fim" date NOT NULL,
	"status" text DEFAULT 'rascunho' NOT NULL,
	"enviada_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "programacoes_status_check" CHECK ("programacoes"."status" IN ('rascunho','enviada'))
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"email" text NOT NULL,
	"telefone" text,
	"whatsapp" text,
	"senha_hash" text NOT NULL,
	"papel" text NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_email_unique" UNIQUE("email"),
	CONSTRAINT "usuarios_papel_check" CHECK ("usuarios"."papel" IN ('supervisor','coordenador','admin'))
);
--> statement-breakpoint
CREATE TABLE "visitas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"programacao_id" uuid,
	"contrato_id" uuid NOT NULL,
	"supervisor_id" uuid NOT NULL,
	"data_prevista" date NOT NULL,
	"origem" text DEFAULT 'programada' NOT NULL,
	"demanda_id" uuid,
	"status" text DEFAULT 'prevista' NOT NULL,
	"realizada_em" timestamp with time zone,
	"motivo_id" uuid,
	"motivo_outro" text,
	"observacao" text,
	"registrado_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "visitas_origem_check" CHECK ("visitas"."origem" IN ('programada','extra','demanda_coordenacao')),
	CONSTRAINT "visitas_status_check" CHECK ("visitas"."status" IN ('prevista','realizada','cancelada'))
);
--> statement-breakpoint
ALTER TABLE "avaliacao_acoes" ADD CONSTRAINT "avaliacao_acoes_avaliacao_id_avaliacoes_id_fk" FOREIGN KEY ("avaliacao_id") REFERENCES "public"."avaliacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avaliacao_competencias" ADD CONSTRAINT "avaliacao_competencias_modelo_id_avaliacao_modelos_id_fk" FOREIGN KEY ("modelo_id") REFERENCES "public"."avaliacao_modelos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avaliacao_criterios" ADD CONSTRAINT "avaliacao_criterios_competencia_id_avaliacao_competencias_id_fk" FOREIGN KEY ("competencia_id") REFERENCES "public"."avaliacao_competencias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avaliacao_notas" ADD CONSTRAINT "avaliacao_notas_avaliacao_id_avaliacoes_id_fk" FOREIGN KEY ("avaliacao_id") REFERENCES "public"."avaliacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avaliacao_notas" ADD CONSTRAINT "avaliacao_notas_criterio_id_avaliacao_criterios_id_fk" FOREIGN KEY ("criterio_id") REFERENCES "public"."avaliacao_criterios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avaliacoes" ADD CONSTRAINT "avaliacoes_modelo_id_avaliacao_modelos_id_fk" FOREIGN KEY ("modelo_id") REFERENCES "public"."avaliacao_modelos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avaliacoes" ADD CONSTRAINT "avaliacoes_supervisor_id_usuarios_id_fk" FOREIGN KEY ("supervisor_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avaliacoes" ADD CONSTRAINT "avaliacoes_avaliador_id_usuarios_id_fk" FOREIGN KEY ("avaliador_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carteira" ADD CONSTRAINT "carteira_contrato_id_contratos_id_fk" FOREIGN KEY ("contrato_id") REFERENCES "public"."contratos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carteira" ADD CONSTRAINT "carteira_supervisor_id_usuarios_id_fk" FOREIGN KEY ("supervisor_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contatos_contrato" ADD CONSTRAINT "contatos_contrato_contrato_id_contratos_id_fk" FOREIGN KEY ("contrato_id") REFERENCES "public"."contratos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demandas_extras" ADD CONSTRAINT "demandas_extras_criado_por_usuarios_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demandas_extras" ADD CONSTRAINT "demandas_extras_supervisor_id_usuarios_id_fk" FOREIGN KEY ("supervisor_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demandas_extras" ADD CONSTRAINT "demandas_extras_contrato_id_contratos_id_fk" FOREIGN KEY ("contrato_id") REFERENCES "public"."contratos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidencias" ADD CONSTRAINT "evidencias_visita_id_visitas_id_fk" FOREIGN KEY ("visita_id") REFERENCES "public"."visitas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidencias" ADD CONSTRAINT "evidencias_plano_id_planos_acao_id_fk" FOREIGN KEY ("plano_id") REFERENCES "public"."planos_acao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidencias" ADD CONSTRAINT "evidencias_atualizacao_id_plano_atualizacoes_id_fk" FOREIGN KEY ("atualizacao_id") REFERENCES "public"."plano_atualizacoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obrigacao_ocorrencias" ADD CONSTRAINT "obrigacao_ocorrencias_obrigacao_id_obrigacoes_id_fk" FOREIGN KEY ("obrigacao_id") REFERENCES "public"."obrigacoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obrigacao_ocorrencias" ADD CONSTRAINT "obrigacao_ocorrencias_supervisor_id_usuarios_id_fk" FOREIGN KEY ("supervisor_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obrigacao_ocorrencias" ADD CONSTRAINT "obrigacao_ocorrencias_contrato_id_contratos_id_fk" FOREIGN KEY ("contrato_id") REFERENCES "public"."contratos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obrigacao_ocorrencias" ADD CONSTRAINT "obrigacao_ocorrencias_marcado_por_usuarios_id_fk" FOREIGN KEY ("marcado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plano_atualizacoes" ADD CONSTRAINT "plano_atualizacoes_plano_id_planos_acao_id_fk" FOREIGN KEY ("plano_id") REFERENCES "public"."planos_acao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plano_atualizacoes" ADD CONSTRAINT "plano_atualizacoes_visita_id_visitas_id_fk" FOREIGN KEY ("visita_id") REFERENCES "public"."visitas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plano_atualizacoes" ADD CONSTRAINT "plano_atualizacoes_autor_id_usuarios_id_fk" FOREIGN KEY ("autor_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planos_acao" ADD CONSTRAINT "planos_acao_contrato_id_contratos_id_fk" FOREIGN KEY ("contrato_id") REFERENCES "public"."contratos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planos_acao" ADD CONSTRAINT "planos_acao_visita_origem_id_visitas_id_fk" FOREIGN KEY ("visita_origem_id") REFERENCES "public"."visitas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planos_acao" ADD CONSTRAINT "planos_acao_aberto_por_usuarios_id_fk" FOREIGN KEY ("aberto_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planos_acao" ADD CONSTRAINT "planos_acao_resolvido_por_usuarios_id_fk" FOREIGN KEY ("resolvido_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programacoes" ADD CONSTRAINT "programacoes_supervisor_id_usuarios_id_fk" FOREIGN KEY ("supervisor_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitas" ADD CONSTRAINT "visitas_programacao_id_programacoes_id_fk" FOREIGN KEY ("programacao_id") REFERENCES "public"."programacoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitas" ADD CONSTRAINT "visitas_contrato_id_contratos_id_fk" FOREIGN KEY ("contrato_id") REFERENCES "public"."contratos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitas" ADD CONSTRAINT "visitas_supervisor_id_usuarios_id_fk" FOREIGN KEY ("supervisor_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitas" ADD CONSTRAINT "visitas_demanda_id_demandas_extras_id_fk" FOREIGN KEY ("demanda_id") REFERENCES "public"."demandas_extras"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitas" ADD CONSTRAINT "visitas_motivo_id_motivos_cancelamento_id_fk" FOREIGN KEY ("motivo_id") REFERENCES "public"."motivos_cancelamento"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "avaliacao_notas_unica" ON "avaliacao_notas" USING btree ("avaliacao_id","criterio_id");--> statement-breakpoint
CREATE UNIQUE INDEX "avaliacoes_supervisor_periodo_unica" ON "avaliacoes" USING btree ("supervisor_id","periodo_inicio");--> statement-breakpoint
CREATE UNIQUE INDEX "carteira_vigente_unica" ON "carteira" USING btree ("contrato_id") WHERE "carteira"."fim" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "obrigacao_ocorrencias_unica" ON "obrigacao_ocorrencias" USING btree ("obrigacao_id","supervisor_id","contrato_id","competencia");--> statement-breakpoint
CREATE INDEX "planos_abertos_por_contrato" ON "planos_acao" USING btree ("contrato_id") WHERE "planos_acao"."status" IN ('aberto','em_andamento');--> statement-breakpoint
CREATE UNIQUE INDEX "programacoes_supervisor_semana_unica" ON "programacoes" USING btree ("supervisor_id","semana_inicio");--> statement-breakpoint
CREATE INDEX "visitas_por_data" ON "visitas" USING btree ("data_prevista");--> statement-breakpoint
CREATE INDEX "visitas_por_supervisor" ON "visitas" USING btree ("supervisor_id","data_prevista");