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
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleRequests, setVisibleRequests] = useState<Record<string, any>[]>([]);

  // Filter data before pagination
  const filteredData = data.filter(r => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      r.request_id?.toString().includes(term) ||
      (r.requester_name && r.requester_name.toLowerCase().includes(term)) ||
      (r.destination_country && r.destination_country.toLowerCase().includes(term)) ||
      (r.request_status && r.request_status.toLowerCase().includes(term))
    );
  });

  const totalPages = Math.ceil(filteredData.length / requestsPerPage);
  
  useEffect(() => {
    const start = (page - 1) * requestsPerPage;
    const end = start + requestsPerPage;
    
    // We already have formatted data from backend (request_id, requester_name, etc)
    // Map status specifically for the DataTable badge
    const paged = filteredData.slice(start, end).map(r => ({
      ...r,
      status: r.request_status // DataTable uses 'status' key for the StatusBadge column logic
    }));
    setVisibleRequests(paged);
  }, [page, filteredData]);
  
  return (
    <div>
      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar por ID, solicitante, destino o estatus..."
          className="w-full md:w-1/2 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-coco-primary focus:border-transparent text-sm"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setPage(1); // Reset to first page on search
          }}
        />
      </div>
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
