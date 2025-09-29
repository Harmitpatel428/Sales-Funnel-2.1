'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useLeads, Lead } from '../context/LeadContext';
import { useHeaders } from '../context/HeaderContext';
import { useColumns } from '../context/ColumnContext';
import { usePasswords } from '../context/PasswordContext';
import { useRouter } from 'next/navigation';
import EditableTable from '../components/EditableTable';
import PasswordModal from '../components/PasswordModal';
import LeadDetailModal from '../components/LeadDetailModal';
import { validateLeadField, validateDynamicField } from '../hooks/useValidation';
// XLSX is imported dynamically to avoid turbopack issues

// Shared field mapping constants for import/export
// @deprecated Use getExportHeaders from '../constants/exportUtils' instead for dynamic headers
export const EXPORT_HEADERS = [
  'con.no', 
  'KVA', 
  'Connection Date', 
  'Company Name', 
  'Client Name', 
  'Discom',
  'GIDC',
  'GST Number',
  'Unit Type',
  'Main Mobile Number', 
  'Lead Status', 
  'Last Discussion', 
  'Address',
  'Next Follow-up Date',
  'Last Activity Date',
  'Mobile Number 2', 
  'Contact Name 2', 
  'Mobile Number 3', 
  'Contact Name 3'
] as const;

// Re-export getExportHeaders for discoverability
export { getExportHeaders } from '../constants/exportUtils';

// Legacy static mappings - now handled dynamically by buildDynamicFieldMapping()
// This constant is kept for reference but should not be used in new code
const LEGACY_IMPORT_FIELD_MAPPINGS = {
  'con.no': 'consumerNumber',
  'consumer number': 'consumerNumber',
  'connection number': 'consumerNumber',
  'kva': 'kva',
  'name': 'kva',
  'full name': 'kva',
  'lead name': 'kva',
  'contact name': 'kva',
  'connection date': 'connectionDate',
  'company': 'company',
  'company name': 'company',
  'organization': 'company',
  'client name': 'clientName',
  'client': 'clientName',
  'discom': 'discom',
  'gidc': 'gidc',
  'gst number': 'gstNumber',
  'gst': 'gstNumber',
  'unit type': 'unitType',
  'type': 'unitType',
  'main mobile number': 'mobileNumber',
  'mobile number': 'mobileNumber',
  'phone': 'mobileNumber',
  'mobile number 2': 'mobileNumber2',
  'mobile number 3': 'mobileNumber3',
  'contact name 2': 'contactName2',
  'contact name 3': 'contactName3',
  'lead status': 'status',
  'status': 'status',
  'last discussion': 'notes',
  'notes': 'notes',
  'discussion': 'notes',
  'address': 'companyLocation',
  'company location': 'companyLocation',
  'location': 'companyLocation',
  'next follow-up date': 'followUpDate',
  'follow-up date': 'followUpDate',
  'followup date': 'followUpDate',
  'last activity date': 'lastActivityDate',
  'last activity': 'lastActivityDate',
  'activity date': 'lastActivityDate'
} as const;

export default function AllLeadsPage() {
  const router = useRouter();
  const { leads, setLeads, permanentlyDeleteLead } = useLeads();
  const { getDisplayName, headerConfig } = useHeaders();
  const { getVisibleColumns } = useColumns();
  const { verifyPassword } = usePasswords();
  const [searchTerm, setSearchTerm] = useState('');

  // Get dynamic export headers
  const getDynamicExportHeaders = useCallback(() => {
    const visibleColumns = getVisibleColumns();
    return visibleColumns.map(column => column.label);
  }, [getVisibleColumns]);

  // Build dynamic field mapping that includes current custom headers and column configuration
  const buildDynamicFieldMapping = useCallback(() => {
    const dynamicMapping: Record<string, keyof Lead> = {};
    
    // Add current custom header names to the mapping
    Object.entries(headerConfig).forEach(([fieldKey, customLabel]) => {
      const labelLower = customLabel.toLowerCase().trim();
      dynamicMapping[labelLower] = fieldKey as keyof Lead;
    });
    
    // Add current column configuration to the mapping
    const visibleColumns = getVisibleColumns();
    visibleColumns.forEach(column => {
      const labelLower = column.label.toLowerCase().trim();
      dynamicMapping[labelLower] = column.fieldKey as keyof Lead;
      
      // Also add common variations for better matching
      if (column.type === 'date') {
        dynamicMapping[labelLower + ' date'] = column.fieldKey as keyof Lead;
        dynamicMapping['date ' + labelLower] = column.fieldKey as keyof Lead;
        dynamicMapping[labelLower.replace(/\s+/g, '')] = column.fieldKey as keyof Lead; // Remove spaces
        dynamicMapping[labelLower.replace(/\s+/g, '_')] = column.fieldKey as keyof Lead; // Replace spaces with underscores
        dynamicMapping[labelLower.replace(/\s+/g, '-')] = column.fieldKey as keyof Lead; // Replace spaces with hyphens
      } else if (column.type === 'phone') {
        dynamicMapping[labelLower + ' number'] = column.fieldKey as keyof Lead;
        dynamicMapping['phone ' + labelLower] = column.fieldKey as keyof Lead;
        dynamicMapping[labelLower.replace(/\s+/g, '')] = column.fieldKey as keyof Lead;
        dynamicMapping[labelLower.replace(/\s+/g, '_')] = column.fieldKey as keyof Lead;
        dynamicMapping[labelLower.replace(/\s+/g, '-')] = column.fieldKey as keyof Lead;
      } else if (column.type === 'email') {
        dynamicMapping[labelLower + ' email'] = column.fieldKey as keyof Lead;
        dynamicMapping['email ' + labelLower] = column.fieldKey as keyof Lead;
        dynamicMapping[labelLower.replace(/\s+/g, '')] = column.fieldKey as keyof Lead;
        dynamicMapping[labelLower.replace(/\s+/g, '_')] = column.fieldKey as keyof Lead;
        dynamicMapping[labelLower.replace(/\s+/g, '-')] = column.fieldKey as keyof Lead;
      } else if (column.type === 'number') {
        dynamicMapping[labelLower + ' number'] = column.fieldKey as keyof Lead;
        dynamicMapping['number ' + labelLower] = column.fieldKey as keyof Lead;
        dynamicMapping[labelLower.replace(/\s+/g, '')] = column.fieldKey as keyof Lead;
        dynamicMapping[labelLower.replace(/\s+/g, '_')] = column.fieldKey as keyof Lead;
        dynamicMapping[labelLower.replace(/\s+/g, '-')] = column.fieldKey as keyof Lead;
      } else {
        // For text and select fields, add common variations
        dynamicMapping[labelLower.replace(/\s+/g, '')] = column.fieldKey as keyof Lead;
        dynamicMapping[labelLower.replace(/\s+/g, '_')] = column.fieldKey as keyof Lead;
        dynamicMapping[labelLower.replace(/\s+/g, '-')] = column.fieldKey as keyof Lead;
      }
    });

    // Add legacy static mappings for backward compatibility
    // These will be used when no dynamic mapping is found
    const legacyMappings = {
      // Consumer Number variations
      'con.no': 'consumerNumber',
      'con.no.': 'consumerNumber',
      'connection number': 'consumerNumber',
      'consumer number': 'consumerNumber',
      'consumernumber': 'consumerNumber',
      
      // KVA/Name variations
      'kva': 'kva',
      'name': 'kva',
      'full name': 'kva',
      'lead name': 'kva',
      'contact name': 'kva',
      
      // Connection Date variations
      'connection date': 'connectionDate',
      'connectiondate': 'connectionDate',
      
      // Company variations
      'company': 'company',
      'company name': 'company',
      'organization': 'company',
      
      // Company Location variations
      'company location': 'companyLocation',
      'companylocation': 'companyLocation',
      'location': 'companyLocation',
      'address': 'companyLocation',
      
      // Client Name variations
      'client name': 'clientName',
      'clientname': 'clientName',
      'client': 'clientName',
      
      // Mobile Number variations
      'mo.no': 'mobileNumber',
      'mo.no.': 'mobileNumber',
      'mo .no': 'mobileNumber',
      'mo .no.': 'mobileNumber',
      'mobile number': 'mobileNumber',
      'mobilenumber': 'mobileNumber',
      'mobile': 'mobileNumber',
      'phone': 'mobileNumber',
      'phone number': 'mobileNumber',
      'contact phone': 'mobileNumber',
      'telephone': 'mobileNumber',
      'main mobile number': 'mobileNumber',
      
      // Unit Type variations
      'unit type': 'unitType',
      'unittype': 'unitType',
      'type': 'unitType',
      
      // Status variations
      'status': 'status',
      'lead status': 'status',
      'current status': 'status',
      'leadstatus': 'status',
      'lead_status': 'status',
      'lead-status': 'status',
      
      // Follow-up Date variations
      'follow up date': 'followUpDate',
      'followup date': 'followUpDate',
      'follow_up_date': 'followUpDate',
      'follow-up-date': 'followUpDate',
      'followup': 'followUpDate',
      'follow_up': 'followUpDate',
      'follow-up': 'followUpDate',
      'next follow up': 'followUpDate',
      'nextfollowup': 'followUpDate',
      'next_follow_up': 'followUpDate',
      'next-follow-up': 'followUpDate',
      'next call date': 'followUpDate',
      'nextcalldate': 'followUpDate',
      'next_call_date': 'followUpDate',
      'next-call-date': 'followUpDate',
      'callback date': 'followUpDate',
      'callbackdate': 'followUpDate',
      'callback_date': 'followUpDate',
      'callback-date': 'followUpDate',
      'reminder date': 'followUpDate',
      'reminderdate': 'followUpDate',
      'reminder_date': 'followUpDate',
      'reminder-date': 'followUpDate',
      
      // Last Activity Date variations
      'last activity date': 'lastActivityDate',
      'lastactivitydate': 'lastActivityDate',
      'last_activity_date': 'lastActivityDate',
      'last activity': 'lastActivityDate',
      'lastactivity': 'lastActivityDate',
      'last_activity': 'lastActivityDate',
      'activity date': 'lastActivityDate',
      'activitydate': 'lastActivityDate',
      'activity_date': 'lastActivityDate',
      'last call date': 'lastActivityDate',
      'lastcalldate': 'lastActivityDate',
      'last_call_date': 'lastActivityDate',
      'last contact date': 'lastActivityDate',
      'lastcontactdate': 'lastActivityDate',
      'last_contact_date': 'lastActivityDate',
      
      // Notes variations
      'notes': 'notes',
      'discussion': 'notes',
      'last discussion': 'notes',
      'lastdiscussion': 'notes',
      'last_discussion': 'notes',
      'last-discussion': 'notes',
      'call notes': 'notes',
      'comments': 'notes',
      'comment': 'notes',
      'description': 'notes',
      
      // GIDC variations
      'gidc': 'gidc',
      
      // Discom variations
      'discom': 'discom',
      
      // GST Number variations
      'gst number': 'gstNumber',
      'gstnumber': 'gstNumber',
      'gst_number': 'gstNumber',
      'gst': 'gstNumber',
      
      // Final Conclusion variations
      'final conclusion': 'finalConclusion',
      'finalconclusion': 'finalConclusion',
      'final_conclusion': 'finalConclusion',
      'conclusion': 'finalConclusion'
    };

    // Add legacy mappings to dynamic mapping
    Object.entries(legacyMappings).forEach(([header, field]) => {
      if (!dynamicMapping[header]) {
        dynamicMapping[header] = field as keyof Lead;
      }
    });
    
    console.log('🔍 Dynamic field mapping built:', dynamicMapping);
    console.log('🔍 Total mappings:', Object.keys(dynamicMapping).length);
    return dynamicMapping;
  }, [headerConfig, getVisibleColumns]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  
  // Bulk delete states
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  
  // Password modal states
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);
  const [pendingDeleteOperation, setPendingDeleteOperation] = useState<{
    type: 'single' | 'bulk';
    lead?: Lead;
    leadIds?: string[];
  } | null>(null);
  
  // Toast notification states
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
  
  // Editable table states
  const [validationErrors, setValidationErrors] = useState<Record<string, Record<string, string>>>({});

  // Show toast notification
  const showToastNotification = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  }, []);

  // Handle cell update
  const handleCellUpdate = useCallback(async (leadId: string, field: string, value: string) => {
    try {
      // Find the lead
      const lead = leads.find(l => l.id === leadId);
      if (!lead) {
        throw new Error('Lead not found');
      }

      // Get current column configuration to validate dynamic fields
      const visibleColumns = getVisibleColumns();
      const columnConfig = visibleColumns.find(col => col.fieldKey === field);
      
      console.log('🔧 Cell update debug:', { leadId, field, value, columnConfig });

      // Validate the field (including custom columns)
      const error = validateLeadField(field as keyof Lead, value, lead, columnConfig);
      if (error) {
        // Set validation error
        setValidationErrors(prev => ({
          ...prev,
          [leadId]: {
            ...prev[leadId],
            [field]: error
          }
        }));
        throw new Error(error);
      }

      // Clear validation error if exists
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        if (newErrors[leadId]) {
          delete newErrors[leadId][field];
          if (Object.keys(newErrors[leadId]).length === 0) {
            delete newErrors[leadId];
          }
        }
        return newErrors;
      });

      // Handle special field formatting
      let formattedValue = value;
      if (field === 'mobileNumbers') {
        // Parse JSON string for mobile numbers
        try {
          const mobileNumbers = JSON.parse(value);
          formattedValue = mobileNumbers;
        } catch {
          throw new Error('Invalid mobile numbers format');
        }
      } else if (columnConfig?.type === 'date' && value) {
        // Format date fields consistently
        formattedValue = formatDateToDDMMYYYY(value);
      }

      // Update the lead with proper field access using safe property assignment
      const updatedLead = {
        ...lead,
        [field]: formattedValue,
        lastActivityDate: new Date().toLocaleDateString('en-GB') // DD-MM-YYYY format
      } as Lead & Record<string, any>; // Allow dynamic properties

      // Only touch activity for important field changes
      const shouldTouchActivity = ['status', 'followUpDate', 'notes'].includes(field);
      setLeads(prev => prev.map(l => l.id === leadId ? {
        ...updatedLead,
        lastActivityDate: shouldTouchActivity ? updatedLead.lastActivityDate : l.lastActivityDate
      } : l));
      showToastNotification('Lead updated successfully!', 'success');
    } catch (error) {
      console.error('Error updating cell:', error);
      showToastNotification(error instanceof Error ? error.message : 'Failed to update lead', 'error');
      throw error;
    }
  }, [leads, setLeads, showToastNotification, getVisibleColumns]);

  // Helper function to format date to DD-MM-YYYY
  const formatDateToDDMMYYYY = (dateString: string): string => {
    if (!dateString) return '';
    
    // If already in DD-MM-YYYY format, return as is
    if (dateString.match(/^\d{2}-\d{2}-\d{4}$/)) {
      return dateString;
    }
    
    // If it's a Date object or ISO string, convert to DD-MM-YYYY
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString; // Return original if invalid
      
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      
      return `${day}-${month}-${year}`;
    } catch {
      return dateString; // Return original if conversion fails
    }
  };

  // Filter leads based on status and search term
  const allLeads = useMemo(() => {
    let filtered = leads; // Show all leads regardless of status or deletion status
    
    if (searchTerm) {
      filtered = filtered.filter(lead => {
        const searchLower = searchTerm.toLowerCase();
        
        // Check if it's a phone number search (only digits)
        if (/^\d+$/.test(searchTerm)) {
          const allMobileNumbers = [
            lead.mobileNumber,
            ...(lead.mobileNumbers || []).map(m => m.number)
          ];
          
          for (const mobileNumber of allMobileNumbers) {
            if (mobileNumber) {
              const phoneDigits = mobileNumber.replace(/[^0-9]/g, '');
              if (phoneDigits.includes(searchTerm)) {
                return true;
              }
            }
          }
        }
        
        // Regular text search
        const allMobileNumbers = [
          lead.mobileNumber,
          ...(lead.mobileNumbers || []).map(m => m.number)
        ].filter(Boolean);
        
        const allMobileNames = (lead.mobileNumbers || []).map(m => m.name).filter(Boolean);
        
        const searchableFields = [
          lead.clientName,
          lead.company,
          ...allMobileNumbers,
          ...allMobileNames,
          lead.consumerNumber,
          lead.kva,
          lead.discom,
          lead.companyLocation,
          lead.notes,
          lead.finalConclusion,
          lead.status
        ].filter(Boolean).map(field => field?.toLowerCase());
        
        return searchableFields.some(field => field?.includes(searchLower));
      });
    }
    
    // Sort leads: deleted leads first, then completed leads, then active leads
    return filtered.sort((a, b) => {
      // If one is deleted and the other isn't, deleted goes first
      if (a.isDeleted && !b.isDeleted) return -1;
      if (!a.isDeleted && b.isDeleted) return 1;
      
      // If both are deleted or both are not deleted, check completion status
      if (a.isDone && !b.isDone) return -1;
      if (!a.isDone && b.isDone) return 1;
      
      // If both have same deletion and completion status, sort by lastActivityDate (most recent first)
      const dateA = new Date(a.lastActivityDate).getTime();
      const dateB = new Date(b.lastActivityDate).getTime();
      return dateB - dateA; // Most recent first
    });
  }, [leads, searchTerm]);


  // Modal functions
  const openModal = (lead: Lead) => {
    setSelectedLead(lead);
    setShowLeadModal(true);
    document.body.style.overflow = 'hidden';
  };

  const closeModal = () => {
    setSelectedLead(null);
    setShowLeadModal(false);
    document.body.style.overflow = 'unset';
  };

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showLeadModal) {
          setShowLeadModal(false);
          document.body.style.overflow = 'unset';
        }
        if (showPasswordModal) {
          setShowPasswordModal(false);
          setPassword('');
          setLeadToDelete(null);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showLeadModal, showPasswordModal]);

  // Handle modal return from edit form
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const returnToModal = urlParams.get('returnToModal');
    const leadId = urlParams.get('leadId');
    
    if (returnToModal === 'true' && leadId) {
      // Find the lead and open the modal
      const lead = leads.find(l => l.id === leadId);
      if (lead) {
        setSelectedLead(lead);
        setShowLeadModal(true);
        document.body.style.overflow = 'hidden';
      }
      
      // Clean up URL parameters
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('returnToModal');
      newUrl.searchParams.delete('leadId');
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, [leads]);

  // Copy to clipboard function
  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  // WhatsApp redirect function
  const handleWhatsAppRedirect = (lead: Lead) => {
    // Get the main phone number
    const mainPhoneNumber = lead.mobileNumbers && lead.mobileNumbers.length > 0 
      ? lead.mobileNumbers.find(m => m.isMain)?.number || lead.mobileNumbers[0]?.number || lead.mobileNumber
      : lead.mobileNumber;

    if (!mainPhoneNumber || mainPhoneNumber.trim() === '') {
      alert('No phone number available for this lead.');
      return;
    }

    // Clean the phone number (remove any non-digit characters)
    const cleanNumber = mainPhoneNumber.replace(/[^0-9]/g, '');
    
    // Check if number is valid (should be 10 digits for Indian numbers)
    if (cleanNumber.length !== 10) {
      alert(`Invalid phone number: ${mainPhoneNumber}. Please check the number format.`);
      return;
    }

    // Create WhatsApp URL
    const whatsappUrl = `https://wa.me/91${cleanNumber}`;
    
    // Open WhatsApp in new tab
    window.open(whatsappUrl, '_blank');
  };

  // Password protection functions using centralized PasswordContext
  const handleDeleteClick = (lead: Lead) => {
    setPendingDeleteOperation({ type: 'single', lead });
    setShowPasswordModal(true);
  };

  const handlePasswordSuccess = () => {
    if (!pendingDeleteOperation) return;
    
    if (pendingDeleteOperation.type === 'single' && pendingDeleteOperation.lead) {
      // Permanently delete when deleting from All Leads page
      permanentlyDeleteLead(pendingDeleteOperation.lead.id);
      showToastNotification('Lead permanently deleted', 'success');
    } else if (pendingDeleteOperation.type === 'bulk' && pendingDeleteOperation.leadIds) {
      // Permanently delete all selected leads
      pendingDeleteOperation.leadIds.forEach(leadId => permanentlyDeleteLead(leadId));
      setSelectedLeads(new Set());
      showToastNotification(`${pendingDeleteOperation.leadIds.length} leads permanently deleted`, 'success');
    }
    
    setShowPasswordModal(false);
    setPendingDeleteOperation(null);
  };

  const handlePasswordCancel = () => {
    setShowPasswordModal(false);
    setPendingDeleteOperation(null);
  };

  // Bulk delete functions
  const handleSelectLead = (leadId: string) => {
    const newSelected = new Set(selectedLeads);
    if (newSelected.has(leadId)) {
      newSelected.delete(leadId);
    } else {
      newSelected.add(leadId);
    }
    setSelectedLeads(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedLeads.size === allLeads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(allLeads.map(lead => lead.id)));
    }
  };

  const handleBulkDeleteClick = () => {
    if (selectedLeads.size === 0) return;
    setPendingDeleteOperation({ type: 'bulk', leadIds: Array.from(selectedLeads) });
    setShowPasswordModal(true);
  };

  // Bulk restore function
  const handleBulkRestoreClick = () => {
    if (selectedLeads.size === 0) return;
    
    // Restore all selected deleted leads
    setLeads(prev => 
      prev.map(lead => 
        selectedLeads.has(lead.id) && lead.isDeleted 
          ? { ...lead, isDeleted: false }
          : lead
      )
    );
    
    setSelectedLeads(new Set());
    
    // Show success message
    alert(`${selectedLeads.size} leads have been restored successfully!`);
  };

  // Check if any selected leads are already deleted
  const hasDeletedLeads = Array.from(selectedLeads).some(leadId => {
    const lead = leads.find(l => l.id === leadId);
    return lead?.isDeleted;
  });




  // Handle lead click
  const handleLeadClick = (lead: Lead) => {
    openModal(lead);
  };

  // Handle edit lead
  const handleEditLead = (lead: Lead) => {
    // Store the lead data in localStorage for editing
    localStorage.setItem('editingLead', JSON.stringify(lead));
    // Store modal return data for ESC key functionality
    localStorage.setItem('modalReturnData', JSON.stringify({
      sourcePage: 'all-leads',
      leadId: lead.id
    }));
    // Navigate to add-lead page with a flag to indicate we're editing
    router.push(`/add-lead?mode=edit&id=${lead.id}&from=all-leads`);
  };

  // File input ref for import
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Convert Excel serial date to readable date string in DD-MM-YYYY format
  const convertExcelDate = (value: string | number | Date | null | undefined): string => {
    console.log('=== CONVERT EXCEL DATE DEBUG ===');
    console.log('Input value:', value);
    console.log('Input type:', typeof value);
    
    if (!value) {
      console.log('Empty value, returning empty string');
      return '';
    }
    
    // If it's already a string, return as is
    if (typeof value === 'string') {
      const trimmed = value.trim();
      console.log('Trimmed string:', trimmed);
      
      // Check if it's already in DD-MM-YYYY format
      if (trimmed.match(/^\d{2}-\d{2}-\d{4}$/)) {
        console.log('Already in DD-MM-YYYY format:', trimmed);
        return trimmed;
      } else if (trimmed.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Convert from YYYY-MM-DD to DD-MM-YYYY
        const parts = trimmed.split('-');
        const year = parts[0];
        const month = parts[1];
        const day = parts[2];
        const converted = `${day}-${month}-${year}`;
        console.log(`Converting date format from YYYY-MM-DD: ${trimmed} to DD-MM-YYYY: ${converted}`);
        return converted;
      } else if (trimmed.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
        // Handle MM/DD/YYYY or DD/MM/YYYY format
        const parts = trimmed.split('/');
        if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
          // Assume DD/MM/YYYY format
          const day = parts[0].padStart(2, '0');
          const month = parts[1].padStart(2, '0');
          const year = parts[2];
          const converted = `${day}-${month}-${year}`;
          console.log(`Converting date format from DD/MM/YYYY: ${trimmed} to DD-MM-YYYY: ${converted}`);
          return converted;
        }
      } else {
        // Try to parse as date and convert
        const date = new Date(trimmed);
        if (!isNaN(date.getTime())) {
          const day = String(date.getDate()).padStart(2, '0');
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const year = date.getFullYear();
          const converted = `${day}-${month}-${year}`;
          console.log(`Converting parsed date: ${trimmed} to DD-MM-YYYY: ${converted}`);
          return converted;
        }
        console.log('Could not parse date, returning original:', trimmed);
        return trimmed; // Return original if can't parse
      }
    }
    
    // If it's a number (Excel serial date), convert it
    if (typeof value === 'number') {
      console.log('Processing number value:', value);
      // Excel serial date (days since 1900-01-01, but Excel incorrectly treats 1900 as leap year)
      const excelEpoch = new Date(1900, 0, 1);
      const date = new Date(excelEpoch.getTime() + (value - 2) * 24 * 60 * 60 * 1000);
      
      if (!isNaN(date.getTime())) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const converted = `${day}-${month}-${year}`;
        console.log(`Converting Excel serial date: ${value} to DD-MM-YYYY: ${converted}`);
        return converted;
      }
    }
    
    // If it's a Date object
    if (value instanceof Date) {
      console.log('Processing Date object:', value);
      const day = String(value.getDate()).padStart(2, '0');
      const month = String(value.getMonth() + 1).padStart(2, '0');
      const year = value.getFullYear();
      const converted = `${day}-${month}-${year}`;
      console.log(`Converting Date object to DD-MM-YYYY: ${converted}`);
      return converted;
    }
    
    console.log('Could not convert value, returning empty string');
    console.log('=== END CONVERT EXCEL DATE DEBUG ===');
    return '';
  };

  // Set default values for required fields and validate custom fields
  const setDefaultValues = (lead: Partial<Lead>) => {
    if (!lead.status) lead.status = 'New';
    if (!lead.unitType) lead.unitType = 'New';
    if (!lead.lastActivityDate) lead.lastActivityDate = new Date().toLocaleDateString('en-GB');
    if (!lead.isDone) lead.isDone = false;
    if (!lead.isDeleted) lead.isDeleted = false;
    if (!lead.isUpdated) lead.isUpdated = false;
    if (!lead.activities) lead.activities = [];
    if (!lead.mandateStatus) lead.mandateStatus = 'Pending';
    if (!lead.documentStatus) lead.documentStatus = 'Pending Documents';
    if (!lead.mobileNumbers) lead.mobileNumbers = [];
    
    // Apply column-based defaults for all visible columns and validate custom fields
    const visibleColumns = getVisibleColumns();
    const validationErrors: string[] = [];
    
    visibleColumns.forEach(column => {
      const currentValue = (lead as any)[column.fieldKey];
      
      // Set default value if undefined
      if (currentValue === undefined) {
        let defaultValue = column.defaultValue;
        
        if (defaultValue === undefined) {
          switch (column.type) {
            case 'date':
              defaultValue = new Date().toLocaleDateString('en-GB');
              break;
            case 'number':
              defaultValue = 0;
              break;
            case 'phone':
            case 'email':
            case 'text':
              defaultValue = '';
              break;
            case 'select':
              defaultValue = column.options?.[0] || '';
              break;
            default:
              defaultValue = '';
          }
        }
        
        (lead as any)[column.fieldKey] = defaultValue;
      } else {
        // Validate existing values for custom fields
        const validationError = validateDynamicField(column.fieldKey, currentValue, column.type, {
          required: column.required,
          maxLength: column.maxLength,
          min: column.min,
          max: column.max,
          options: column.options,
          allowPast: column.allowPast
        });
        
        if (validationError) {
          validationErrors.push(`${column.label}: ${validationError}`);
        }
      }
    });
    
    // Add validation errors to lead if any
    if (validationErrors.length > 0) {
      (lead as any).validationErrors = validationErrors;
    }
  };

  // Map header to lead field - enhanced to support custom headers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapHeaderToField = (lead: Partial<Lead>, header: string, value: any) => {
    const headerLower = header.toLowerCase().trim();
    console.log('=== MAPPING DEBUG ===');
    console.log('Header: "' + header + '" -> "' + headerLower + '"');
    console.log('Value: "' + value + '" (type: ' + typeof value + ')');
    console.log('Value length: ' + (value ? value.toString().length : 'undefined'));
    console.log('Is empty: ' + (!value || value === '' || value === null || value === undefined));
    console.log('Processing header: ' + headerLower);

    // First, try to map using dynamic field mapping (includes custom headers and columns)
    const dynamicMapping = buildDynamicFieldMapping();
    const fieldKey = dynamicMapping[headerLower];
    
    if (fieldKey) {
      console.log('🎯 DYNAMIC MAPPING FOUND:', headerLower, '->', fieldKey);
      
      // Get column configuration for type-specific handling
      const visibleColumns = getVisibleColumns();
      const columnConfig = visibleColumns.find(col => col.fieldKey === fieldKey);
      
      // Apply the value based on field type
      if (columnConfig?.type === 'date' || 
          ['connectionDate', 'lastActivityDate', 'followUpDate'].includes(fieldKey)) {
        // Handle date fields
        if (value && value !== '') {
          const dateValue = isExcelDate(value) ? convertExcelDate(value) : String(value);
          (lead as any)[fieldKey] = dateValue;
          console.log('Mapped date field:', fieldKey, '=', dateValue);
        }
      } else if (columnConfig?.type === 'number') {
        // Handle number fields
        if (value && value !== '') {
          const numValue = Number(value);
          if (!isNaN(numValue)) {
            (lead as any)[fieldKey] = numValue;
            console.log('Mapped number field:', fieldKey, '=', numValue);
          } else {
            (lead as any)[fieldKey] = String(value);
            console.log('Mapped number field as string:', fieldKey, '=', String(value));
          }
        }
      } else if (columnConfig?.type === 'phone') {
        // Handle phone fields - clean numeric input
        if (value && value !== '') {
          const phoneValue = String(value).replace(/[^0-9]/g, '');
          (lead as any)[fieldKey] = phoneValue;
          console.log('Mapped phone field:', fieldKey, '=', phoneValue);
        }
      } else if (columnConfig?.type === 'email') {
        // Handle email fields
        if (value && value !== '') {
          (lead as any)[fieldKey] = String(value).toLowerCase().trim();
          console.log('Mapped email field:', fieldKey, '=', String(value));
        }
      } else {
        // Handle other fields as strings
        (lead as any)[fieldKey] = String(value);
        console.log('Mapped field:', fieldKey, '=', String(value));
      }
      return; // Exit early if mapping found
    }

    // If no dynamic mapping found, try legacy static mappings for backward compatibility
    console.log('⚠️ No dynamic mapping found, trying legacy mappings for:', headerLower);
    
    // Special handling for discom headers - check if header contains "discom" in any case
    if (headerLower.includes('discom')) {
      console.log('=== DISCOM HEADER DETECTED ===');
      console.log('Original header:', header);
      console.log('Header lowercase:', headerLower);
      console.log('Value:', value);
      console.log('Value type:', typeof value);
      console.log('String value:', String(value));
      lead.discom = String(value);
      console.log('Mapped discom:', lead.discom);
      console.log('=== END DISCOM MAPPING DEBUG ===');
      return; // Exit early to avoid switch statement
    }
    
    // Handle complex mobile number array logic that can't be easily mapped dynamically
    switch (headerLower) {
      // Main mobile number - complex array logic
      case 'mo.no':
      case 'mo.no.':
      case 'mo .no':
      case 'mo .no.':
      case 'mobile number':
      case 'mobilenumber':
      case 'mobile':
      case 'phone':
      case 'phone number':
      case 'contact phone':
      case 'telephone':
      case 'main mobile number':
        console.log('*** MOBILE NUMBER MAPPING ***');
        console.log('Setting mobileNumber to: "' + String(value) + '"');
        console.log('Original value: "' + value + '" (type: ' + typeof value + ')');
        lead.mobileNumber = String(value);
        console.log('Lead mobileNumber after setting: "' + lead.mobileNumber + '"');
        
        // Also populate the mobileNumbers array with the main mobile number
        if (!lead.mobileNumbers) {
          lead.mobileNumbers = [];
        }
        
        // Ensure we have at least one slot
        if (lead.mobileNumbers.length === 0) {
          lead.mobileNumbers.push({
            id: '1',
            number: String(value),
            name: lead.clientName || '', // Auto-populate contact name with client name
            isMain: true
          });
          console.log('Added main mobile number to mobileNumbers array:', lead.mobileNumbers[0]);
        } else {
          // Update the first slot if it exists
          lead.mobileNumbers[0] = {
            id: '1',
            number: String(value),
            name: lead.clientName || lead.mobileNumbers[0]?.name || '', // Auto-populate contact name with client name
            isMain: true
          };
          console.log('Updated main mobile number in mobileNumbers array:', lead.mobileNumbers[0]);
        }
        break;
      // Mobile Number 2 - complex array logic
      case 'mobile number 2':
      case 'mobile number2':
      case 'mobile2':
      case 'phone 2':
      case 'phone2':
      case 'mobile no 2':
      case 'mobile no. 2':
      case 'mobile no2':
      case 'contact number 2':
      case 'contact no 2':
      case 'mobile 2':
      case 'phone no 2':
      case 'phone no. 2':
      case 'phone no2':
      case 'tel 2':
      case 'tel2':
      case 'telephone 2':
      case 'telephone2':
        console.log('*** MOBILE NUMBER 2 MAPPING ***');
        console.log('Setting mobileNumber2 to: "' + String(value) + '"');
        console.log('Current lead.mobileNumber:', lead.mobileNumber);
        console.log('Current lead.mobileNumbers:', lead.mobileNumbers);
        
        // Initialize mobileNumbers array if it doesn't exist
        if (!lead.mobileNumbers) {
          lead.mobileNumbers = [];
          console.log('Initialized mobileNumbers array');
        }
        
        // Always ensure we have at least 2 slots
        while (lead.mobileNumbers.length < 2) {
                lead.mobileNumbers.push({
            id: String(lead.mobileNumbers.length + 1), 
            number: '', 
                  name: '',
            isMain: lead.mobileNumbers.length === 0 
          });
          console.log('Added slot', lead.mobileNumbers.length, 'isMain:', lead.mobileNumbers[lead.mobileNumbers.length - 1]?.isMain);
        }
        
        // Set the second mobile number (index 1)
        lead.mobileNumbers[1] = { 
          id: '2', 
          number: String(value), 
          name: lead.mobileNumbers[1]?.name || '', 
                  isMain: false
        };
        console.log('Set mobile number 2:', lead.mobileNumbers[1]);
        
        // If we have a main mobile number but no entry in slot 0, add it
        if (lead.mobileNumber && (!lead.mobileNumbers[0] || !lead.mobileNumbers[0].number)) {
          lead.mobileNumbers[0] = { 
            id: '1', 
            number: lead.mobileNumber, 
                  name: '',
                  isMain: true
          };
          console.log('Added main mobile number to slot 0:', lead.mobileNumbers[0]);
        }
        
        console.log('Final mobileNumbers array:', lead.mobileNumbers);
        break;
      // Mobile Number 3 - complex array logic
      case 'mobile number 3':
      case 'mobile number3':
      case 'mobile3':
      case 'phone 3':
      case 'phone3':
      case 'mobile no 3':
      case 'mobile no. 3':
      case 'mobile no3':
      case 'contact number 3':
      case 'contact no 3':
        console.log('*** MOBILE NUMBER 3 MAPPING ***');
        console.log('Setting mobileNumber3 to: "' + String(value) + '"');
        if (!lead.mobileNumbers) {
          // Initialize with main mobile number if it exists
          lead.mobileNumbers = [];
          if (lead.mobileNumber) {
            lead.mobileNumbers.push({ id: '1', number: lead.mobileNumber, name: '', isMain: true });
          }
        }
        // Ensure we have at least 3 slots
        while (lead.mobileNumbers.length < 3) {
          lead.mobileNumbers.push({ id: String(lead.mobileNumbers.length + 1), number: '', name: '', isMain: false });
        }
        // Set the third mobile number
        lead.mobileNumbers[2] = { 
          id: '3', 
          number: String(value), 
          name: lead.mobileNumbers[2]?.name || '', 
          isMain: false 
        };
        break;
      // Contact Name 2 - complex array logic
      case 'contact name 2':
      case 'contact name2':
      case 'contact2':
      case 'name 2':
      case 'name2':
      case 'contact person 2':
      case 'person name 2':
      case 'contact person2':
      case 'contact 2':
      case 'person 2':
      case 'person2':
      case 'contact person name 2':
      case 'contact person name2':
      case 'person contact 2':
      case 'person contact2':
        console.log('*** CONTACT NAME 2 MAPPING ***');
        console.log('Setting contact name 2 to: "' + String(value) + '"');
        console.log('Current lead.mobileNumber:', lead.mobileNumber);
        console.log('Current lead.mobileNumbers:', lead.mobileNumbers);
        
        // Initialize mobileNumbers array if it doesn't exist
        if (!lead.mobileNumbers) {
          lead.mobileNumbers = [];
          console.log('Initialized mobileNumbers array');
        }
        
        // Always ensure we have at least 2 slots
        while (lead.mobileNumbers.length < 2) {
                lead.mobileNumbers.push({
            id: String(lead.mobileNumbers.length + 1), 
                  number: '',
            name: '', 
            isMain: lead.mobileNumbers.length === 0 
          });
          console.log('Added slot', lead.mobileNumbers.length, 'isMain:', lead.mobileNumbers[lead.mobileNumbers.length - 1]?.isMain);
        }
        
        // Set the second contact name (index 1)
        lead.mobileNumbers[1] = { 
          id: '2', 
          number: lead.mobileNumbers[1]?.number || '', 
          name: String(value), 
          isMain: false 
        };
        console.log('Set contact name 2:', lead.mobileNumbers[1]);
        
        // If we have a main mobile number but no entry in slot 0, add it
        if (lead.mobileNumber && (!lead.mobileNumbers[0] || !lead.mobileNumbers[0].number)) {
          lead.mobileNumbers[0] = { 
            id: '1', 
            number: lead.mobileNumber, 
            name: '', 
            isMain: true 
          };
          console.log('Added main mobile number to slot 0:', lead.mobileNumbers[0]);
        }
        
        console.log('Final mobileNumbers array:', lead.mobileNumbers);
        break;
      // Contact Name 3 - complex array logic
      case 'contact name 3':
      case 'contact name3':
      case 'contact3':
      case 'name 3':
      case 'name3':
      case 'contact person 3':
      case 'person name 3':
      case 'contact person3':
        console.log('*** CONTACT NAME 3 MAPPING ***');
        console.log('Setting contact name 3 to: "' + String(value) + '"');
        if (!lead.mobileNumbers) {
          // Initialize with main mobile number if it exists
          lead.mobileNumbers = [];
          if (lead.mobileNumber) {
            lead.mobileNumbers.push({ id: '1', number: lead.mobileNumber, name: '', isMain: true });
          }
        }
        // Ensure we have at least 3 slots
        while (lead.mobileNumbers.length < 3) {
          lead.mobileNumbers.push({ id: String(lead.mobileNumbers.length + 1), number: '', name: '', isMain: false });
        }
        // Set the third contact name
        lead.mobileNumbers[2] = { 
          id: '3', 
          number: lead.mobileNumbers[2]?.number || '', 
          name: String(value), 
          isMain: false 
        };
        break;
      // Status - complex mapping logic
      case 'lead status':
      case 'leadstatus':
      case 'status':
      case 'current status':
      case 'lead_status':
      case 'lead-status':
        console.log('*** STATUS MAPPING ***');
        console.log('Status value: "' + String(value) + '"');
        const statusValue = String(value).toLowerCase().trim();
        if (statusValue === 'new') {
              lead.status = 'New';
          console.log('✅ Mapped to New');
        } else if (statusValue === 'cnr') {
          lead.status = 'CNR';
          console.log('✅ Mapped to CNR');
        } else if (statusValue === 'busy') {
          lead.status = 'Busy';
          console.log('✅ Mapped to Busy');
        } else if (statusValue === 'follow-up' || statusValue === 'followup' || statusValue === 'follow up') {
              lead.status = 'Follow-up';
          console.log('✅ Mapped to Follow-up');
        } else if (statusValue === 'deal close' || statusValue === 'dealclose' || statusValue === 'deal_close') {
          lead.status = 'Deal Close';
          console.log('✅ Mapped to Deal Close');
        } else if (statusValue === 'work alloted' || statusValue === 'workalloted' || statusValue === 'work_alloted' || statusValue === 'wao') {
          lead.status = 'Work Alloted';
          console.log(`✅ Mapped "${statusValue}" to Work Alloted (will display as WAO)`);
        } else if (statusValue === 'hotlead' || statusValue === 'hot lead' || statusValue === 'hot_lead') {
          lead.status = 'Hotlead';
          console.log('✅ Mapped to Hotlead');
        } else if (statusValue === 'mandate sent' || statusValue === 'mandatesent' || statusValue === 'mandate_sent') {
          lead.status = 'Mandate Sent';
          console.log('✅ Mapped to Mandate Sent');
        } else if (statusValue === 'documentation') {
          lead.status = 'Documentation';
          console.log('✅ Mapped to Documentation');
        } else if (statusValue === 'others' || statusValue === 'other') {
          lead.status = 'Others';
          console.log('✅ Mapped to Others');
        } else {
          // Flexible mapping for variations
          if (statusValue.includes('new')) {
            lead.status = 'New';
            console.log('✅ Flexible mapping: New');
          } else if (statusValue.includes('cnr')) {
            lead.status = 'CNR';
            console.log('✅ Flexible mapping: CNR');
          } else if (statusValue.includes('busy')) {
            lead.status = 'Busy';
            console.log('✅ Flexible mapping: Busy');
            } else if (statusValue.includes('follow')) {
              lead.status = 'Follow-up';
            console.log('✅ Flexible mapping: Follow-up');
          } else if (statusValue.includes('deal') || statusValue.includes('close')) {
              lead.status = 'Deal Close';
            console.log('✅ Flexible mapping: Deal Close');
          } else if (statusValue.includes('work') || statusValue.includes('allot') || statusValue.includes('wao')) {
            lead.status = 'Work Alloted';
            console.log(`✅ Flexible mapping: "${statusValue}" -> Work Alloted (will display as WAO)`);
          } else if (statusValue.includes('hot')) {
            lead.status = 'Hotlead';
            console.log('✅ Flexible mapping: Hotlead');
          } else if (statusValue.includes('mandate')) {
            lead.status = 'Mandate Sent';
            console.log('✅ Flexible mapping: Mandate Sent');
          } else if (statusValue.includes('document')) {
            lead.status = 'Documentation';
            console.log('✅ Flexible mapping: Documentation');
          } else if (statusValue.includes('other')) {
            lead.status = 'Others';
            console.log('✅ Flexible mapping: Others');
            } else {
            lead.status = 'New'; // Default fallback
            console.log('⚠️ Default mapping: New');
          }
        }
        break;
      // Unit Type - complex mapping logic
      case 'unit type':
      case 'unittype':
      case 'unit_type':
      case 'type':
        console.log('*** UNIT TYPE MAPPING ***');
        console.log('Unit type value: "' + String(value) + '"');
        const unitTypeValue = String(value).toLowerCase().trim();
        if (unitTypeValue === 'new') {
          lead.unitType = 'New';
          console.log('✅ Mapped to New');
        } else if (unitTypeValue === 'existing') {
          lead.unitType = 'Existing';
          console.log('✅ Mapped to Existing');
        } else if (unitTypeValue === 'other' || unitTypeValue === 'others') {
          lead.unitType = 'Other';
          console.log('✅ Mapped to Other');
        } else {
          // Allow custom unit types
          lead.unitType = String(value).trim();
          console.log('✅ Custom unit type:', lead.unitType);
        }
        break;
      // Follow-up Date - complex date logic
      case 'follow-up date':
      case 'followup date':
      case 'follow_up_date':
      case 'followupdate':
      case 'next follow-up':
      case 'next followup':
      case 'next_follow_up':
      case 'nextfollowup':
      case 'follow up date':
      case 'followup':
      case 'follow-up':
      case 'next follow up':
      case 'next follow-up date':
      case 'next followup date':
      case 'next_follow_up_date':
      case 'nextfollowupdate':
      case 'follow_up':
      case 'followup_date':
      case 'next_followup':
      case 'nextfollowup_date':
        console.log('*** FOLLOW-UP DATE MAPPING ***');
        console.log('Follow-up date value: "' + String(value) + '"');
        console.log('Follow-up date value type:', typeof value);
        lead.followUpDate = convertExcelDate(value);
        console.log('Follow-up date after setting: "' + lead.followUpDate + '"');
        break;
      // Last Activity Date - complex date logic
      case 'last activity date':
      case 'lastactivitydate':
      case 'last_activity_date':
      case 'last activity':
      case 'lastactivity':
      case 'last_activity':
      case 'activity date':
      case 'activitydate':
      case 'activity_date':
      case 'last call date':
      case 'lastcalldate':
      case 'last_call_date':
      case 'last contact date':
      case 'lastcontactdate':
      case 'last_contact_date':
        console.log('*** LAST ACTIVITY DATE MAPPING ***');
        console.log('Last activity date value: "' + String(value) + '"');
        console.log('Last activity date value type:', typeof value);
        lead.lastActivityDate = convertExcelDate(value);
        console.log('Last activity date after setting: "' + lead.lastActivityDate + '"');
        break;
      // Notes - complex append logic
      case 'notes':
      case 'discussion':
      case 'last discussion':
      case 'lastdiscussion':
      case 'last_discussion':
      case 'last-discussion':
      case 'call notes':
      case 'comments':
      case 'comment':
      case 'description':
        // If notes already exist, append the new value
        if (lead.notes) {
          lead.notes = `${lead.notes} | ${String(value)}`;
        } else {
          lead.notes = String(value);
        }
        break;
      // Simple field mappings (now handled by dynamic mapping, but kept for backward compatibility)
      case 'gidc':
        lead.gidc = String(value);
        break;
      case 'gst number':
      case 'gstnumber':
      case 'gst_number':
      case 'gst':
        lead.gstNumber = String(value);
        break;
      case 'final conclusion':
      case 'finalconclusion':
      case 'final_conclusion':
      case 'conclusion':
        lead.finalConclusion = String(value);
        break;
      default:
        console.log('⚠️ UNMAPPED HEADER: ' + headerLower);
        break;
    }
    
    // Fallback: Check for partial matches for mobile number 2 and contact name 2
    if (headerLower.includes('mobile') && headerLower.includes('2') && !headerLower.includes('name')) {
      console.log('🔄 FALLBACK: Mobile Number 2 detected via partial match:', headerLower);
      if (!lead.mobileNumbers) {
        lead.mobileNumbers = [];
        if (lead.mobileNumber) {
          lead.mobileNumbers.push({ id: '1', number: lead.mobileNumber, name: '', isMain: true });
        }
      }
      while (lead.mobileNumbers.length < 2) {
        lead.mobileNumbers.push({ id: String(lead.mobileNumbers.length + 1), number: '', name: '', isMain: false });
      }
      lead.mobileNumbers[1] = { 
        id: '2', 
        number: String(value), 
        name: lead.mobileNumbers[1]?.name || '', 
        isMain: false 
      };
      return;
    }
    
    if (headerLower.includes('contact') && headerLower.includes('2') && headerLower.includes('name')) {
      console.log('🔄 FALLBACK: Contact Name 2 detected via partial match:', headerLower);
      if (!lead.mobileNumbers) {
        lead.mobileNumbers = [];
        if (lead.mobileNumber) {
          lead.mobileNumbers.push({ id: '1', number: lead.mobileNumber, name: '', isMain: true });
        }
      }
      while (lead.mobileNumbers.length < 2) {
        lead.mobileNumbers.push({ id: String(lead.mobileNumbers.length + 1), number: '', name: '', isMain: false });
      }
      lead.mobileNumbers[1] = { 
        id: '2', 
        number: lead.mobileNumbers[1]?.number || '', 
        name: String(value), 
        isMain: false 
      };
      return;
    }
    
    console.log('=== END MAPPING DEBUG ===');
  };

  // Parse CSV file
  const parseCSV = (content: string): Partial<Lead>[] => {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0]?.split(',').map(h => h.trim().replace(/"/g, '')) || [];
    console.log('CSV Headers:', headers);
    
    // Show import mapping preview for CSV
    const mappingPreview = showImportMappingPreview(headers);

    return lines.slice(1).map((line) => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      const lead: Partial<Lead> = {};

      headers.forEach((header, index) => {
        const value = values[index] || '';
        mapHeaderToField(lead, header, value);
      });

      // Set default values for required fields
      setDefaultValues(lead);
      return lead;
    });
  };

  // Parse Excel file using xlsx library
  const parseExcel = async (file: File): Promise<Partial<Lead>[]> => {
    console.log('Starting Excel parsing...');
    
    try {
      // Dynamic import to avoid turbopack issues
      const XLSX = await import('xlsx');
      console.log('XLSX library loaded successfully');
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
          try {
            console.log('File read successfully, size:', e.target?.result);
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            console.log('Data converted to Uint8Array, length:', data.length);
            
            const workbook = XLSX.read(data, { type: 'array' });
            console.log('Workbook read, sheet names:', workbook.SheetNames);
            
            // Get the first sheet
            const sheetName = workbook.SheetNames[0];
            if (!sheetName) {
              reject(new Error('No sheets found in Excel file'));
              return;
            }
            const worksheet = workbook.Sheets[sheetName];
            if (!worksheet) {
              reject(new Error('Could not load worksheet'));
              return;
            }
            console.log('Worksheet loaded:', sheetName);
            
            // Convert to JSON with proper date handling
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
              header: 1,
              raw: false, // Convert dates to strings for better handling
              defval: '',
              dateNF: 'dd-mm-yyyy' // Specify date format
            });
            console.log('JSON data:', jsonData);
            
            if (jsonData.length < 2) {
              reject(new Error('No data rows found in Excel file'));
              return;
            }
            
            const headers = jsonData[0] as string[];
            console.log('Excel Headers:', headers);
            
            // Show import mapping preview
            const mappingPreview = showImportMappingPreview(headers);
            
            const leads = jsonData.slice(1).map((row: unknown, index: number) => {
              const rowArray = row as any[];
              const lead: Partial<Lead> = {};
              
              headers.forEach((header, colIndex) => {
                const value = rowArray[colIndex];
                if (value !== undefined && value !== null && value !== '') {
                  console.log(`Processing row ${index + 1}, header: "${header}", value: "${value}"`);
                  
                  // Special debug for discom headers
                  if (header && header.toLowerCase().includes('discom')) {
                    console.log('=== DISCOM HEADER DEBUG ===');
                    console.log('Header:', header);
                    console.log('Value:', value);
                    console.log('Value type:', typeof value);
                    console.log('Value length:', value ? value.toString().length : 'undefined');
                    console.log('=== END DISCOM HEADER DEBUG ===');
                  }
                  
                  // Special debug for follow-up date headers
                  if (header && (header.toLowerCase().includes('follow') || header.toLowerCase().includes('next'))) {
                    console.log('=== FOLLOW-UP DATE HEADER DEBUG ===');
                    console.log('Header:', header);
                    console.log('Value:', value);
                    console.log('Value type:', typeof value);
                    console.log('Value length:', value ? value.toString().length : 'undefined');
                    console.log('=== END FOLLOW-UP DATE HEADER DEBUG ===');
                  }
                  
                  // Special debug for last activity date headers
                  if (header && (header.toLowerCase().includes('activity') || header.toLowerCase().includes('last'))) {
                    console.log('=== LAST ACTIVITY DATE HEADER DEBUG ===');
                    console.log('Header:', header);
                    console.log('Value:', value);
                    console.log('Value type:', typeof value);
                    console.log('Value length:', value ? value.toString().length : 'undefined');
                    console.log('=== END LAST ACTIVITY DATE HEADER DEBUG ===');
                  }
                  
                  mapHeaderToField(lead, header, value);
                }
              });

              // Set default values for required fields
              setDefaultValues(lead);
              console.log('Processed lead:', lead);
              return lead;
            });

            console.log('All leads processed:', leads);
            resolve(leads);
    } catch (error) {
            console.error('Excel parsing error:', error);
            reject(new Error(`Error parsing Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`));
          }
        };

        reader.onerror = () => {
          console.error('FileReader error');
          reject(new Error('Failed to read file'));
        };
        
        console.log('Starting file read...');
        reader.readAsArrayBuffer(file);
      });
    } catch (error) {
      console.error('Failed to load XLSX library:', error);
      throw new Error('Failed to load Excel parsing library');
    }
  };

  // Show import mapping preview
  const showImportMappingPreview = (headers: string[]) => {
    const dynamicMapping = buildDynamicFieldMapping();
    const visibleColumns = getVisibleColumns();
    
    console.log('📊 Import Mapping Preview:');
    console.log('Excel Headers:', headers);
    console.log('Available Mappings:', Object.keys(dynamicMapping).length);
    
    const mappingPreview = headers.map(header => {
      const headerLower = header.toLowerCase().trim();
      const mappedField = dynamicMapping[headerLower];
      const columnConfig = visibleColumns.find(col => col.fieldKey === mappedField);
      
      return {
        excelHeader: header,
        mappedField: mappedField || 'UNMAPPED',
        columnLabel: columnConfig?.label || 'Unknown',
        columnType: columnConfig?.type || 'text',
        isMapped: !!mappedField
      };
    });
    
    console.log('📊 Mapping Preview:', mappingPreview);
    
    const mappedCount = mappingPreview.filter(m => m.isMapped).length;
    const unmappedCount = mappingPreview.filter(m => !m.isMapped).length;
    
    console.log(`📊 Mapping Summary: ${mappedCount} mapped, ${unmappedCount} unmapped`);
    
    // Show user-visible summary of unmapped headers
    const unmappedHeaders = mappingPreview.filter(m => !m.isMapped);
    if (unmappedHeaders.length > 0) {
      const unmappedList = unmappedHeaders.map(h => h.excelHeader).join(', ');
      const availableColumns = visibleColumns.map(col => col.label).join(', ');
      
      const message = `⚠️ ${unmappedCount} headers could not be mapped: ${unmappedList}\n\nAvailable column labels: ${availableColumns}\n\nConsider renaming headers to match current column labels for better import results.`;
      
      // Show as toast notification
      setShowToast(true);
      setToastMessage(message);
      setToastType('info');
      
      // Auto-hide after 8 seconds for longer message
      setTimeout(() => {
        setShowToast(false);
      }, 8000);
    }
    
    return mappingPreview;
  };

  // Handle Excel/CSV import
  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('=== EXCEL IMPORT STARTED ===');
    const file = event.target.files?.[0];
    if (!file) {
      console.log('No file selected');
      return;
    }

    console.log('File selected:', file.name, file.type, file.size);

    try {
      let leads: Partial<Lead>[] = [];
      
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        console.log('Processing CSV file...');
        const content = await file.text();
        leads = parseCSV(content);
      } else {
        console.log('Processing Excel file...');
        leads = await parseExcel(file);
      }

      console.log('Parsed leads:', leads);

      // Show import preview with dynamic column mapping
      const importPreview = leads.slice(0, 3).map(lead => {
        const preview: Record<string, any> = {};
        const visibleColumns = getVisibleColumns();
        
        // Show mapped fields
        visibleColumns.forEach(column => {
          const value = (lead as any)[column.fieldKey];
          if (value !== undefined && value !== '') {
            preview[column.label] = value;
          }
        });
        
        return preview;
      });
      
      console.log('📊 Import Preview (first 3 leads):', importPreview);
      console.log('📊 Total leads to import:', leads.length);
      console.log('📊 Available columns:', visibleColumns.map(c => c.label));

      // Filter out leads without client names and validate data
      const validLeads = leads.filter(lead => {
        if (!lead.clientName || lead.clientName.trim() === '') {
          return false;
        }
        
        // Validate required fields
        const tempLead: Lead = {
          id: '',
          kva: lead.kva || '',
          consumerNumber: lead.consumerNumber || '',
          company: lead.company || '',
          clientName: lead.clientName || '',
          status: lead.status || 'New',
          mobileNumber: '',
          mobileNumbers: [],
          isDone: false,
          isDeleted: false,
          isUpdated: false
        };
        
        // Check for validation errors
        const kvaError = validateLeadField('kva', tempLead.kva, tempLead);
        const consumerError = validateLeadField('consumerNumber', tempLead.consumerNumber, tempLead);
        const companyError = validateLeadField('company', tempLead.company, tempLead);
        const clientError = validateLeadField('clientName', tempLead.clientName, tempLead);
        
        // Validate dynamic columns
        const visibleColumns = getVisibleColumns();
        let hasDynamicValidationErrors = false;
        
        visibleColumns.forEach(column => {
          if (column.required) {
            const value = (lead as any)[column.fieldKey];
            if (!value || value.toString().trim() === '') {
              console.log(`❌ Required field missing: ${column.label} for lead ${lead.clientName}`);
              hasDynamicValidationErrors = true;
            }
          }
        });
        
        return !kvaError && !consumerError && !companyError && !clientError && !hasDynamicValidationErrors;
      });
      console.log('Valid leads (with client names and validation):', validLeads);

      if (validLeads.length > 0) {
        // Add unique IDs to leads and auto-detect last activity date
        const leadsWithIds = validLeads.map((lead, index) => {
          // Auto-detect last activity date if not provided
          let lastActivityDate = lead.lastActivityDate;
          if (!lastActivityDate || lastActivityDate.trim() === '') {
            // Set to current date in DD-MM-YYYY format
            const now = new Date();
            const day = String(now.getDate()).padStart(2, '0');
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const year = now.getFullYear();
            lastActivityDate = `${day}-${month}-${year}`;
            console.log(`Auto-detected last activity date for ${lead.clientName}: ${lastActivityDate}`);
          }
          
          // Auto-populate main mobile number contact name if not provided
          let mobileNumbers = lead.mobileNumbers || [];
          if (mobileNumbers.length > 0 && mobileNumbers[0] && mobileNumbers[0].number && !mobileNumbers[0].name) {
            mobileNumbers[0] = {
              ...mobileNumbers[0],
              name: lead.clientName || ''
            };
            console.log(`Auto-populated contact name for main mobile number: ${mobileNumbers[0].name}`);
          }
          
          return {
            ...lead,
            id: `imported-${Date.now()}-${index}`,
            lastActivityDate: lastActivityDate,
            mobileNumbers: mobileNumbers,
          };
        }) as Lead[];

        console.log('Leads with IDs:', leadsWithIds);

        // Add leads to the system
        setLeads(prev => [...prev, ...leadsWithIds]);
        
        // Trigger data migration for any new columns that might have been added
        const visibleColumns = getVisibleColumns();
        console.log('🔄 Import completed, checking for data migration needs...');
        console.log('📊 Current visible columns:', visibleColumns.map(c => c.label));
        
        // Show success notification with validation info
        const totalLeads = leads.length;
        const invalidLeads = totalLeads - validLeads.length;
        let message = `Successfully imported ${validLeads.length} leads from ${file.name}`;
        if (invalidLeads > 0) {
          message += ` (${invalidLeads} leads skipped due to validation errors)`;
        }
        
        // Add dynamic column info to success message
        const dynamicColumns = visibleColumns.filter(col => 
          !['kva', 'consumerNumber', 'company', 'clientName', 'connectionDate', 'discom', 'gidc', 'gstNumber', 'unitType', 'status', 'mobileNumber', 'mobileNumbers', 'companyLocation', 'followUpDate', 'lastActivityDate', 'notes'].includes(col.fieldKey)
        );
        
        if (dynamicColumns.length > 0) {
          message += `\nDynamic columns detected: ${dynamicColumns.map(c => c.label).join(', ')}`;
        }
        
        setShowToast(true);
        setToastMessage(message);
        setToastType('success');
        
        // Auto-hide toast after 5 seconds
        setTimeout(() => {
          setShowToast(false);
        }, 5000);
      } else {
        setShowToast(true);
        setToastMessage(`No valid leads found in ${file.name}`);
        setToastType('error');
        
        // Auto-hide toast after 5 seconds
        setTimeout(() => {
          setShowToast(false);
        }, 5000);
      }
      
      // Clear the file input
      event.target.value = '';
    } catch (error) {
      console.error('=== IMPORT ERROR ===');
      console.error('Import error:', error);
      
      // Show error notification
      setShowToast(true);
      setToastMessage(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setToastType('error');
      
      // Auto-hide toast after 5 seconds
      setTimeout(() => {
        setShowToast(false);
      }, 5000);
    }
  };

  // Helper function to format dates for export (DD-MM-YYYY format only)
  const formatDateForExport = (dateString: string): string => {
    if (!dateString || dateString.trim() === '') {
      return '';
    }
    
    // If already in DD-MM-YYYY format, return as is
    if (dateString.match(/^\d{2}-\d{2}-\d{4}$/)) {
      return dateString;
    }
    
    // If it's an ISO date string or Date object, convert to DD-MM-YYYY
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return dateString; // Return original if invalid
      }
      
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      
      return `${day}-${month}-${year}`;
    } catch {
      return dateString; // Return original if conversion fails
    }
  };

  // Export function (copied from dashboard)
  const handleExportExcel = async () => {
    try {
      // Small delay to ensure pending header edits are saved
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Dynamic import to avoid turbopack issues
      const XLSX = await import('xlsx');
      
      // Get filtered leads
      const leadsToExport = allLeads;
      
      // Use dynamic export headers based on current column configuration
      const visibleColumns = getVisibleColumns();
      const headers = visibleColumns.map(column => column.label);
      
      // Convert leads to Excel rows with remapped data
      const rows = leadsToExport.map(lead => {
        // Get mobile numbers and contacts
        const mobileNumbers = lead.mobileNumbers || [];
        const mainMobile = mobileNumbers.find(m => m.isMain) || mobileNumbers[0] || { number: lead.mobileNumber || '', name: '' };
        
        // Format main mobile number (phone number only, no contact name)
        const mainMobileDisplay = mainMobile.number || '';
        console.log('🔍 Export Debug - Lead:', lead.clientName, 'Main Mobile:', mainMobileDisplay);
        
        // Map data according to visible columns
        return visibleColumns.map(column => {
          const fieldKey = column.fieldKey;
          const value = (lead as any)[fieldKey] ?? '';
          
          // Handle special field formatting
          switch (fieldKey) {
            case 'kva':
              return lead.kva || '';
            case 'connectionDate':
              return formatDateForExport(lead.connectionDate || '');
            case 'consumerNumber':
              return lead.consumerNumber || '';
            case 'company':
              return lead.company || '';
            case 'clientName':
              return lead.clientName || '';
            case 'discom':
              return lead.discom || '';
            case 'mobileNumber':
              return mainMobileDisplay;
            case 'status':
              return lead.status === 'Work Alloted' ? 'WAO' : (lead.status || 'New');
            case 'lastActivityDate':
              return formatDateForExport(lead.lastActivityDate || '');
            case 'followUpDate':
              return formatDateForExport(lead.followUpDate || '');
            default:
              // Handle custom columns
              if (column.type === 'date') {
                return formatDateForExport(value);
              }
              return value || '';
          }
        });
      });
      
      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      
      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Leads');
      
      // Generate Excel file and download
      XLSX.writeFile(wb, `leads-export-all-${new Date().toISOString().split('T')[0]}.xlsx`);
      
      // Show success notification
      setShowToast(true);
      setToastMessage(`Successfully exported ${leadsToExport.length} leads to Excel format`);
      setToastType('success');
      
      // Auto-hide toast after 5 seconds
      setTimeout(() => {
        setShowToast(false);
      }, 5000);
    } catch (error) {
      console.error('Export error:', error);
      setShowToast(true);
      setToastMessage('Failed to export leads. Please try again.');
      setToastType('error');
      
      // Auto-hide toast after 5 seconds
      setTimeout(() => {
        setShowToast(false);
      }, 5000);
    }
  };


  return (
    <div className="container mx-auto px-1 py-1">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-800 rounded-lg mb-2 p-2">
        {/* Title Section */}
        <div className="text-center mb-1">
          <h1 className="text-lg md:text-xl font-bold text-white mb-1">
            All Leads
          </h1>
          <p className="text-blue-100 text-xs font-medium">
            🚷 This page is strictly reserved for Admins Anil Patel & Jitendra Patel - unauthorized access will be monitored.
          </p>
        </div>
        
        {/* Stats and Action Buttons */}
        <div className="flex flex-col lg:flex-row items-center justify-between space-y-1 lg:space-y-0 lg:space-x-1">
          {/* Total Leads Stat Box - Enhanced */}
          <div className="relative group">
            {/* Animated Border Glow */}
            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-400 via-blue-500 to-purple-500 rounded-2xl blur-sm opacity-0 group-hover:opacity-25 transition-all duration-600 animate-pulse"></div>
            
            {/* Main Container */}
            <div className="relative bg-white border-2 border-blue-200 rounded-lg px-3 py-2 shadow-lg hover:shadow-xl transition-all duration-300 hover:border-blue-300 overflow-hidden">
              {/* Animated Background Waves */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-50/40 via-emerald-50/20 to-purple-50/40 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
              <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              
              {/* Floating Dots */}
              <div className="absolute top-4 right-4 w-1 h-1 bg-emerald-400 rounded-full opacity-0 group-hover:opacity-70 animate-bounce animation-delay-1000"></div>
              <div className="absolute bottom-4 left-4 w-1 h-1 bg-blue-400 rounded-full opacity-0 group-hover:opacity-70 animate-bounce animation-delay-2000"></div>
              <div className="absolute top-1/2 right-6 w-0.5 h-0.5 bg-purple-400 rounded-full opacity-0 group-hover:opacity-70 animate-bounce animation-delay-3000"></div>
              
              {/* Content */}
              <div className="relative z-10 text-center">
                <div className="text-lg md:text-xl font-bold text-blue-600 mb-1 group-hover:text-blue-700 transition-colors duration-300 group-hover:scale-105 transform transition-transform duration-300">
                  {allLeads.length}
                </div>
                <div className="text-black text-xs font-semibold uppercase tracking-wide group-hover:text-black transition-colors duration-300">
                  Total Leads
                </div>
              </div>
              
              {/* Top and Bottom Accent Lines */}
              <div className="absolute top-0 left-1/2 right-1/2 h-0.5 bg-gradient-to-r from-emerald-400 to-blue-500 transform -translate-x-1/2 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-center"></div>
              <div className="absolute bottom-0 left-1/2 right-1/2 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 transform -translate-x-1/2 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-center"></div>
              
              {/* Side Accent Lines */}
              <div className="absolute top-1/2 left-0 w-0.5 h-8 bg-gradient-to-b from-emerald-400 to-blue-500 transform -translate-y-1/2 scale-y-0 group-hover:scale-y-100 transition-transform duration-500 origin-center"></div>
              <div className="absolute top-1/2 right-0 w-0.5 h-8 bg-gradient-to-b from-blue-500 to-purple-500 transform -translate-y-1/2 scale-y-0 group-hover:scale-y-100 transition-transform duration-500 origin-center"></div>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex flex-wrap justify-center items-center space-x-1">
            {/* Import Button */}
            <div className="relative">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.xlsm,.csv"
                onChange={handleFileImport}
                className="hidden"
                id="file-import"
              />
              <label
                htmlFor="file-import"
                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded cursor-pointer flex items-center space-x-1 text-xs font-semibold transition-colors shadow-lg"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
                <span>Import Leads</span>
              </label>
            </div>
            
            {/* Export Button */}
            <button
              onClick={handleExportExcel}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded flex items-center space-x-1 text-xs font-semibold transition-colors shadow-lg"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Export All Leads</span>
            </button>
            
          </div>
        </div>
      </div>



      {/* Leads Table */}
      <div className="bg-white rounded-lg shadow-md mb-2">
        <div className="p-1">
          <div className="flex justify-between items-center mb-1">
            <div className="flex items-center space-x-1">
              <h2 className="text-sm font-semibold text-black">All Leads</h2>
              
              {/* Search Input */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                  <svg className="h-3 w-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  id="search"
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search leads..."
                  className="block w-40 pl-6 pr-2 py-1 border border-gray-300 rounded leading-5 bg-white placeholder:text-black focus:outline-none focus:placeholder:text-black focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-xs text-black"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-black"
                    title="Clear search"
                  >
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={handleSelectAll}
                className="px-3 py-1 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                {selectedLeads.size === allLeads.length ? 'Deselect All' : 'Select All'}
              </button>
              {selectedLeads.size > 0 && (
                <>
                  <button
                    onClick={handleBulkDeleteClick}
                    className="px-3 py-1 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
                  >
                    Delete Selected ({selectedLeads.size})
                  </button>
                  {hasDeletedLeads && (
                    <button
                      onClick={handleBulkRestoreClick}
                      className="px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
                    >
                      Restore Selected ({selectedLeads.size})
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
          <EditableTable
            leads={allLeads}
            onLeadClick={handleLeadClick}
            onDelete={handleDeleteClick}
            selectedLeads={selectedLeads}
            onLeadSelection={handleSelectLead}
            showActions={false}
            emptyMessage="No leads found in the system"
            editable={true}
            headerEditable={true}
            onExportClick={handleExportExcel}
            onCellUpdate={handleCellUpdate}
            validationErrors={validationErrors}
            onImportClick={() => fileInputRef.current?.click()}
            onColumnAdded={(column) => {
              // Handle column addition
              console.log('Column added:', column);
            }}
            onColumnDeleted={(fieldKey) => {
              // Handle column deletion
              console.log('Column deleted:', fieldKey);
            }}
            onColumnReorder={(newOrder) => {
              // Handle column reordering
              console.log('Columns reordered:', newOrder);
            }}
            onRowsAdded={(count) => {
              // Handle row addition
              console.log('Rows added:', count);
            }}
            onRowsDeleted={(count) => {
              // Handle row deletion
              console.log('Rows deleted:', count);
            }}
          />
        </div>
      </div>

      {/* Lead Detail Modal */}
      <LeadDetailModal
        isOpen={showLeadModal}
        onClose={() => {
          setShowLeadModal(false);
          document.body.style.overflow = 'unset';
        }}
        lead={selectedLead!}
        onEdit={handleEditLead}
        onDelete={handleDeleteClick}
      />

      {/* Password Protection Modal */}
      <PasswordModal
        isOpen={showPasswordModal}
        onClose={handlePasswordCancel}
        operation="rowManagement"
        onSuccess={handlePasswordSuccess}
        title={pendingDeleteOperation?.type === 'bulk' ? 'Delete Multiple Leads' : 'Delete Lead'}
        description={
          pendingDeleteOperation?.type === 'bulk' 
            ? `You are about to permanently delete ${pendingDeleteOperation.leadIds?.length || 0} leads from the system. This action cannot be undone.`
            : `You are about to permanently delete this lead from the system: ${pendingDeleteOperation?.lead?.clientName} - ${pendingDeleteOperation?.lead?.company}. This action cannot be undone.`
        }
      />

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-4 right-4 z-50">
          <div className={`px-4 py-2 rounded-md shadow-lg ${
            toastType === 'success' ? 'bg-green-500 text-white' :
            toastType === 'error' ? 'bg-red-500 text-white' :
            'bg-blue-500 text-white'
          }`}>
            {toastMessage}
          </div>
        </div>
      )}

    </div>
  );
}
