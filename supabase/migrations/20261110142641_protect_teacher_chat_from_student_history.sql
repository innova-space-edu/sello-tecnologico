-- Mantener el chat Provi limitado a docentes y administración.
-- Las políticas existentes ya restringen quién puede enviar mensajes.
-- Este guard restrictivo impide visualizar mensajes de autores estudiantes
-- incluso si fueron enviados antes de activarse los permisos actuales.
-- No se borran registros: el historial sigue disponible para auditoría
-- autorizada con credenciales de servicio.
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS group_messages_staff_authors_only ON public.group_messages;
CREATE POLICY group_messages_staff_authors_only
ON public.group_messages AS RESTRICTIVE
FOR SELECT TO authenticated
USING (
  (SELECT auth.uid()) IS NOT NULL
  AND (SELECT private.can_use_teacher_chat())
  AND EXISTS (
    SELECT 1 FROM public.profiles AS author
    WHERE author.id = group_messages.sender_id
      AND lower(coalesce(author.role, '')) IN ('docente', 'admin')
  )
);
