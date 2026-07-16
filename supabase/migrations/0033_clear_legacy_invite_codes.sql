update public.ledger_invitations
set invite_code = '',
    status = case when status = 'active' then 'revoked' else status end
where invite_code <> '';
