begin;

create sequence if not exists public.chat_messages_sequence_id_seq;

alter table public.chat_messages
  add column if not exists sequence_id bigint;

alter sequence public.chat_messages_sequence_id_seq
  owned by public.chat_messages.sequence_id;

alter table public.chat_messages
  alter column sequence_id
  set default nextval('public.chat_messages_sequence_id_seq'::regclass);

with sequence_base as (
  select coalesce(max(sequence_id), 0) as value
  from public.chat_messages
),
ordered_messages as (
  select
    id,
    (select value from sequence_base)
      + row_number() over (order by created_at asc, id asc) as value
  from public.chat_messages
  where sequence_id is null
)
update public.chat_messages as message
set sequence_id = ordered_messages.value
from ordered_messages
where message.id = ordered_messages.id;

do $$
declare
  highest_sequence bigint;
begin
  select coalesce(max(sequence_id), 0)
  into highest_sequence
  from public.chat_messages;

  if highest_sequence = 0 then
    perform setval(
      'public.chat_messages_sequence_id_seq'::regclass,
      1,
      false
    );
  else
    perform setval(
      'public.chat_messages_sequence_id_seq'::regclass,
      highest_sequence,
      true
    );
  end if;
end
$$;

alter table public.chat_messages
  alter column sequence_id set not null;

create unique index if not exists chat_messages_sequence_id_unique
  on public.chat_messages (sequence_id);

create index if not exists chat_messages_chat_sequence_idx
  on public.chat_messages (chat_id, sequence_id desc);

grant usage on sequence public.chat_messages_sequence_id_seq
  to authenticated;

commit;
