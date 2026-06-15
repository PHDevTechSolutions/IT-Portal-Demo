import { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function convertEmail(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        res.setHeader("Allow", ["POST"]);
        return res.status(405).json({ success: false, message: `Method ${req.method} not allowed` });
    }

    try {
        const { ids } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, message: "No user IDs provided" });
        }

        let modifiedCount = 0;
        for (const id of ids) {
            // First get current email to compute new values
            let fetchQuery = supabase.from('users').select('id, Email, Company');
            if (!isNaN(Number(id))) {
                fetchQuery = fetchQuery.or(`id.eq.${id},ReferenceID.eq.${id}`);
            } else {
                fetchQuery = fetchQuery.eq('ReferenceID', id);
            }
            
            const { data: users, error: fetchError } = await fetchQuery;

            if (fetchError) throw fetchError;
            if (!users || users.length === 0) continue;
            
            const existingUser = users[0];
            const currentEmail = existingUser.Email;
            const localPart = currentEmail ? currentEmail.split('@')[0] : '';
            const newEmail = `${localPart}@disruptivesolutionsinc.com`;
            
            // Determine company
            let newCompany = existingUser.Company;
            if (currentEmail) {
                if (currentEmail.toLowerCase().endsWith('@disruptivesolutionsinc.com')) {
                    newCompany = 'Disruptive Solutions Inc';
                } else if (currentEmail.toLowerCase().endsWith('@ecoshiftcorp.com')) {
                    newCompany = 'Ecoshift Corporation';
                }
            }
            
            const { error: updateError } = await supabase
                .from('users')
                .update({
                    Email: newEmail,
                    Company: newCompany,
                    updatedAt: new Date()
                })
                .eq('id', existingUser.id);
            
            if (updateError) throw updateError;
            
            modifiedCount++;
        }

        return res.status(200).json({
            success: true,
            message: `${modifiedCount} emails updated successfully`
        });

    } catch (error: any) {
        console.error("Error converting emails:", error.message);
        return res.status(500).json({ success: false, message: "Failed to convert emails" });
    }
}
