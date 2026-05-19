/**
 * Author: Diego Ortega Fernández (Adapted for global CxP view)
 *
 **/

import { useState, useEffect } from 'react';
import DataTable from '@components/Table/DataTable';
import Pagination from '@components/Table/Pagination';
import type { UserRole } from "@type/roles";

interface Props {
  data: any[];
  role: UserRole;
}

interface Column {
  key: string;
  label: string;
}

const columns: Column[] = [
  { key: 'request_id', label: 'ID Viaje' },
  { key: 'requester_name', label: 'Solicitante' },
  { key: 'destination_country', label: 'Destino' },
  { key: 'beginning_date', label: 'Fecha Salida' },
  { key: 'ending_date', label: 'Fecha Llegada' },
  { key: 'request_status', label: 'Status' },
  { key: 'action', label: 'Acciones' },
];

export default function CxPAllRequestsList({ data, role }: Props) {
  const requestsPerPage = 15;
  const [page, setPage] = useState(1);
  const [visibleRequests, setVisibleRequests] = useState<Record<string, any>[]>([]);
  const totalPages = Math.ceil(data.length / requestsPerPage);
  
  useEffect(() => {
    const start = (page - 1) * requestsPerPage;
    const end = start + requestsPerPage;
    
    // We already have formatted data from backend (request_id, requester_name, etc)
    // Map status specifically for the DataTable badge
    const paged = data.slice(start, end).map(r => ({
      ...r,
      status: r.request_status // DataTable uses 'status' key for the StatusBadge column logic
    }));
    setVisibleRequests(paged);
  }, [page, data]);
  
  return (
    <div>
      <div className="flex flex-col w-full gap-4 min-h-160">
        <DataTable 
          columns={columns} 
          rows={visibleRequests} 
          type="detalles-solicitud" 
          role={role}
        />
      </div>
      {totalPages > 1 && (
        <Pagination
          totalPages={totalPages}
          page={page}
          setPage={setPage}
          maxVisible={5}
        />
      )}
    </div>
  );
}
