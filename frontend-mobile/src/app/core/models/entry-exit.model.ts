export interface RawEntryExitRecordDto {
  id: number;
  // action can be string 'Entry'/'Exit' or numeric enum
  action?: string | number;
  Action?: string | number;

  personType?: string | number;
  PersonType?: string | number;

  personName?: string;
  PersonName?: string;
  name?: string;

  timestamp?: string;
  Timestamp?: string;
  entryTime?: string;

  gate?: string;
  Gate?: string;

  guardName?: string;
  GuardName?: string;
  recordedBy?: string;

  projectName?: string;
  ProjectName?: string;
  contractorName?: string;
  ContractorName?: string;

  labourId?: number;
  LabourId?: number;
  labourRegistrationId?: number;
  visitorId?: number;
  VisitorId?: number;
}

export interface EntryExitRecord {
  id: number;
  personType: 'Labour' | 'Visitor';
  personName?: string;
  action: 'Entry' | 'Exit';
  timestamp: string;
  gate?: string | null;
  guardName?: string | null;
  projectName?: string | null;
  contractorName?: string | null;
  labourId?: number | null;
  visitorId?: number | null;
}
