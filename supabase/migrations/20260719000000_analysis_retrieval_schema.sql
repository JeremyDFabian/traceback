create table public.analysis_regions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  external_id text not null,
  label text,
  transcription text not null,
  region_type text not null,
  bbox_x double precision not null check (bbox_x between 0 and 1),
  bbox_y double precision not null check (bbox_y between 0 and 1),
  bbox_width double precision not null check (bbox_width between 0 and 1),
  bbox_height double precision not null check (bbox_height between 0 and 1),
  confidence double precision not null check (confidence between 0 and 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, external_id)
);

create table public.analysis_markers (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references public.analysis_regions(id) on delete cascade,
  marker_type text not null,
  confidence double precision not null check (confidence between 0 and 1),
  unique (region_id, marker_type)
);

create table public.analysis_relationships (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  external_id text not null,
  source_region_external_id text not null,
  target_region_external_id text not null,
  label text not null,
  confidence double precision not null check (confidence between 0 and 1),
  created_at timestamptz not null default now(),
  unique (session_id, external_id)
);

create table public.slide_passages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  slide_number integer not null check (slide_number > 0),
  passage_index integer not null check (passage_index >= 0),
  text text not null,
  bbox_x double precision not null check (bbox_x between 0 and 1),
  bbox_y double precision not null check (bbox_y between 0 and 1),
  bbox_width double precision not null check (bbox_width between 0 and 1),
  bbox_height double precision not null check (bbox_height between 0 and 1),
  created_at timestamptz not null default now(),
  unique (session_id, slide_number, passage_index)
);

create table public.region_matches (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  region_external_id text not null,
  slide_passage_id uuid references public.slide_passages(id) on delete set null,
  similarity_score double precision not null check (similarity_score between 0 and 1),
  match_status text not null default 'candidate'
    check (match_status in ('candidate', 'confirmed', 'uncertain')),
  created_at timestamptz not null default now()
);

create table public.flashcard_suggestions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  external_id text not null,
  region_external_id text not null,
  question text not null,
  answer text not null,
  source_slide integer check (source_slide is null or source_slide > 0),
  suggestion_status text not null default 'suggested'
    check (suggestion_status in ('suggested', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  unique (session_id, external_id)
);

create index analysis_regions_session_id_idx
  on public.analysis_regions (session_id);
create index analysis_relationships_session_id_idx
  on public.analysis_relationships (session_id);
create index slide_passages_session_id_idx
  on public.slide_passages (session_id);
create index region_matches_session_id_region_idx
  on public.region_matches (session_id, region_external_id);
create index flashcard_suggestions_session_id_idx
  on public.flashcard_suggestions (session_id);

create trigger analysis_regions_set_updated_at
before update on public.analysis_regions
for each row execute function public.set_updated_at();

alter table public.analysis_regions enable row level security;
alter table public.analysis_markers enable row level security;
alter table public.analysis_relationships enable row level security;
alter table public.slide_passages enable row level security;
alter table public.region_matches enable row level security;
alter table public.flashcard_suggestions enable row level security;

comment on table public.analysis_regions is
  'Notebook regions produced by analysis and reviewed by the student.';
comment on table public.analysis_markers is
  'Markers such as stars and question marks attached to notebook regions.';
comment on table public.analysis_relationships is
  'Directed relationships between reviewed notebook regions.';
comment on table public.slide_passages is
  'Extracted lecture text spans with normalized slide coordinates.';
comment on table public.region_matches is
  'Candidate or reviewed links between notebook regions and slide passages.';
comment on table public.flashcard_suggestions is
  'Editable learning-card suggestions generated from confirmed notebook regions.';
