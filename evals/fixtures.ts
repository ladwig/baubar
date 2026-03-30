/**
 * Hardcoded fixture data returned by the mock fetch in evals.
 * Edit these to match realistic data in your test org.
 */

export const PROJECTS = [
  { id: 'aaaa0001-0000-0000-0000-000000000001', name: 'Mehrhaus Mitte',    address: 'Hauptstr. 12, Berlin',        status: { label: 'In Arbeit',     type: 'IN_PROGRESS' }, client: 'Müller GmbH' },
  { id: 'aaaa0001-0000-0000-0000-000000000002', name: 'Gartenanlage Nord', address: 'Parkweg 5, Hamburg',          status: { label: 'Offen',         type: 'OPEN'        }, client: 'Schmidt AG'  },
  { id: 'aaaa0001-0000-0000-0000-000000000003', name: 'Bürogebäude Ost',   address: 'Industriestr. 88, München',   status: { label: 'Abgeschlossen', type: 'DONE'        }, client: 'Weber KG'    },
]

export const REPORTS: Record<string, unknown[]> = {
  'aaaa0001-0000-0000-0000-000000000001': [
    { id: 'bbbb0001-0000-0000-0000-000000000001', project_id: 'aaaa0001-0000-0000-0000-000000000001', report_type: 'Tagesbericht',     text_content: 'Estrich wurde gegossen. Trocknungszeit 3 Tage.',          created_at: '2026-03-29T10:00:00Z' },
    { id: 'bbbb0001-0000-0000-0000-000000000002', project_id: 'aaaa0001-0000-0000-0000-000000000001', report_type: 'Mängelprotokoll',  text_content: 'Riss in der Außenwand, Achse B4. Fotos liegen vor.',      created_at: '2026-03-28T14:00:00Z' },
  ],
  'aaaa0001-0000-0000-0000-000000000002': [
    { id: 'bbbb0001-0000-0000-0000-000000000003', project_id: 'aaaa0001-0000-0000-0000-000000000002', report_type: 'Abnahme',          text_content: 'Bepflanzung abgenommen. Alles in Ordnung.',               created_at: '2026-03-27T09:00:00Z' },
  ],
}

export const CREATED_REPORT_STUB = {
  id: 'cccc0001-0000-0000-0000-000000000001',
  report_type: 'Tagesbericht',
  text_content: '',
  created_at: new Date().toISOString(),
}
