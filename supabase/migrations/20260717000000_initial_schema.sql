create extension if not exists "pgcrypto";

create type public.session_status as enum (
  'created',
  'processing',
  'ready',
  'failed'
);

create type public.job_status as enum (
  'queued',
  'processing',
  'completed',
  'failed'
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  status public.session_status not null default 'created',
  notebook_image_path text,
  processed_image_path text,
  lecture_pdf_path text,
  active_slide integer check (active_slide is null or active_slide > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.processing_jobs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  status public.job_status not null default 'queued',
  stage text not null,
  progress smallint not null default 0 check (progress between 0 and 100),
  result_reference text,
  error_code text,
  error_message text,
  retryable boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint completed_job_has_result check (
    status <> 'completed' or result_reference is not null
  ),
  constraint failed_job_has_error check (
    status <> 'failed' or (error_code is not null and error_message is not null)
  )
);

create index processing_jobs_session_id_idx
  on public.processing_jobs (session_id);

create function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger sessions_set_updated_at
before update on public.sessions
for each row execute function public.set_updated_at();

create trigger processing_jobs_set_updated_at
before update on public.processing_jobs
for each row execute function public.set_updated_at();

alter table public.sessions enable row level security;
alter table public.processing_jobs enable row level security;

comment on table public.sessions is
  'Study sessions accessed by the backend service role.';
comment on table public.processing_jobs is
  'Asynchronous processing state polled through FastAPI.';
