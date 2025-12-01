export type PersonType = 'Labour' | 'Visitor';

export interface PersonSearchResult {
  id: number;
  personType: PersonType;
  name: string;
  phoneNumber?: string;
  subtitle?: string;
  contractorName?: string;
  projectName?: string;
  companyName?: string | null;
  purpose?: string | null;
  hasOpenEntry: boolean;
  photoUrl?: string | null;
  barcode?: string | null;
}

export interface ContractorLabourResult {
  id: number;
  name: string;
  phoneNumber?: string | null;
  barcode?: string | null;
  hasOpenEntry: boolean;
  photoUrl?: string | null;
}
