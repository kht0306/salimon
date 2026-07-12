update public.categories as category
set
  color = preset.color,
  updated_at = now()
from (
  values
    ('주거비', '#c94f5d'),
    ('공과금', '#d97841'),
    ('구독 및 멤버십', '#c58b2a'),
    ('생활비', '#7a8b3d'),
    ('식비', '#d65a3a'),
    ('의료비', '#278c75'),
    ('보험료', '#4d8a5b'),
    ('통신비', '#2e8796'),
    ('교육비', '#4d6fa9'),
    ('저축', '#5961a8'),
    ('여가비', '#7958a6'),
    ('경조사', '#a45586'),
    ('용돈', '#b85d73'),
    ('교통', '#3b7f9d'),
    ('기타', '#727a82')
) as preset(name, color)
where category.name = preset.name;
