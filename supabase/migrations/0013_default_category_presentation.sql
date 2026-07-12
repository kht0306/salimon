create or replace function public.apply_default_category_presentation()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  preset_icon text;
  preset_color text;
begin
  if not new.is_default then
    return new;
  end if;

  select preset.icon, preset.color
  into preset_icon, preset_color
  from (
    values
      ('expense', '식비', 'utensils', '#d65a3a'),
      ('expense', '카페/간식', 'coffee', '#d99a24'),
      ('expense', '교통', 'bus', '#3b7f9d'),
      ('expense', '생활', 'shopping-basket', '#3f8a70'),
      ('expense', '기타', 'more-horizontal', '#727a82'),
      ('income', '급여', 'briefcase-business', '#2d6a4f'),
      ('income', '기타 수입', 'circle-plus', '#685a8f')
  ) as preset(type, name, icon, color)
  where preset.type = new.type
    and preset.name = new.name;

  if found then
    new.icon := preset_icon;
    new.color := preset_color;
  end if;

  return new;
end;
$$;

drop trigger if exists categories_default_presentation_before_insert
on public.categories;

create trigger categories_default_presentation_before_insert
before insert on public.categories
for each row
execute function public.apply_default_category_presentation();

update public.categories as category
set
  icon = preset.icon,
  color = preset.color,
  updated_at = now()
from (
  values
    ('expense', '식비', 'utensils', '#d65a3a'),
    ('expense', '카페/간식', 'coffee', '#d99a24'),
    ('expense', '교통', 'bus', '#3b7f9d'),
    ('expense', '생활', 'shopping-basket', '#3f8a70'),
    ('expense', '기타', 'more-horizontal', '#727a82'),
    ('income', '급여', 'briefcase-business', '#2d6a4f'),
    ('income', '기타 수입', 'circle-plus', '#685a8f')
) as preset(type, name, icon, color)
where category.is_default
  and category.type = preset.type
  and category.name = preset.name;
