import { NextApiRequest, NextApiResponse } from "next";
import { supabase } from '@/utils/supabase';

export default async function fetchAccounts(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  try {
    const { data, error } = await supabase
      .from('users')
      .select('*');

    if (error) throw error;

    // Map Postgres data to match expected frontend format (add _id as ReferenceID for compatibility)
    const formatted = (data || []).map((u: any) => ({
      ...u,
      _id: u.ReferenceID || u.referenceid || u.id,
    }));
    
    res.status(200).json(formatted);
  } catch (error: any) {
    console.error('[Fetch] Error fetching data:', error.message);
    res.status(200).json([]); 
  }
}
