import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/utils/supabase';
import { logSystemAudit, type AuditActor } from "@/lib/audit/system-audit";

// Helper to get actor from session/request
function getActorFromRequest(req: NextApiRequest): AuditActor {
  const userEmail = req.headers["x-user-email"] as string || "system";
  const userRole = req.headers["x-user-role"] as string || "unknown";
  const userId = req.headers["x-user-id"] as string || null;
  
  return {
    uid: userId,
    email: userEmail,
    role: userRole,
  };
}

export default async function DeleteUser(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'DELETE') {
        res.setHeader('Allow', ['DELETE']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
        return;
    }

    const { id } = req.body;

    try {
        // Get user info before deletion for audit log
        // id could be numeric 'id' or custom 'ReferenceID'
        let fetchQuery = supabase.from('users').select('*');
        if (!isNaN(Number(id))) {
          fetchQuery = fetchQuery.or(`id.eq.${id},ReferenceID.eq.${id}`);
        } else {
          fetchQuery = fetchQuery.eq('ReferenceID', id);
        }

        const { data: users, error: fetchError } = await fetchQuery;

        if (fetchError) throw fetchError;
        const userToDelete = users && users.length > 0 ? users[0] : null;

        if (userToDelete) {
          const { error: deleteError } = await supabase
              .from('users')
              .delete()
              .eq('id', userToDelete.id); // Use the numeric id for the actual delete

          if (deleteError) throw deleteError;
          
          // Log audit
          const actor = getActorFromRequest(req);
          await logSystemAudit({
            action: "delete",
            module: "UserManagement",
            page: "/admin/roles",
            resourceType: "user",
            resourceId: userToDelete.UserId || id,
            resourceName: `${userToDelete.Firstname} ${userToDelete.Lastname}`,
            actor,
            source: "DeleteUserAPI",
            metadata: {
              email: userToDelete.Email,
              role: userToDelete.Role,
              department: userToDelete.Department,
            },
          });
        }
        
        res.status(200).json({ success: true, message: 'Data deleted successfully' });
    } catch (error: any) {
        console.error('Error deleting data:', error.message);
        res.status(500).json({ error: 'Failed to delete data' });
    }
}
