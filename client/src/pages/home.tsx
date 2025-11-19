import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Copy, Ticket, Plus, Layers, Search, Trash2, AlertTriangle, Download, Upload, Settings, Filter } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import type { PromoCode, BulkGenerate, CampaignGenerate } from "@shared/schema";
import TokenManager from "@/components/TokenManager";

export default function Home() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [codeFormat, setCodeFormat] = useState("PROMO-XXXX");
  const [bulkCount, setBulkCount] = useState(5);
  const [redeemCode, setRedeemCode] = useState("");
  const [isRedeemModalOpen, setIsRedeemModalOpen] = useState(false);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [discountValue, setDiscountValue] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [selectedCampaign, setSelectedCampaign] = useState("all");
  const [discountFilter, setDiscountFilter] = useState("");
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [codeToDelete, setCodeToDelete] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [showTokenManager, setShowTokenManager] = useState(false);
  const [showAdvancedTools, setShowAdvancedTools] = useState(false);
  const [isAdvancedDeleteOpen, setIsAdvancedDeleteOpen] = useState(false);
  const [deleteFilterCampaign, setDeleteFilterCampaign] = useState("");
  const [deleteFilterStatus, setDeleteFilterStatus] = useState("");
  const [deleteFilterDiscount, setDeleteFilterDiscount] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const { toast } = useToast();

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);
  const [usePagination, setUsePagination] = useState(true);

  // Fetch promo codes (with optional pagination)
  const { data: codesResponse, isLoading: isLoadingCodes, error: codesError } = useQuery<PromoCode[] | { data: PromoCode[]; total: number; page: number; totalPages: number }>({
    queryKey: usePagination ? ["/api/promo-codes", currentPage, itemsPerPage, searchTerm, selectedCampaign, statusFilter, discountFilter] : ["/api/promo-codes"],
    queryFn: async () => {
      if (usePagination) {
        const params = new URLSearchParams({
          page: currentPage.toString(),
          limit: itemsPerPage.toString()
        });
        
        if (searchTerm) params.append('search', searchTerm);
        if (selectedCampaign !== 'all') params.append('campaign', selectedCampaign);
        if (statusFilter !== 'all') params.append('status', statusFilter);
        if (discountFilter) params.append('discount', discountFilter);
        
        const response = await apiRequest("GET", `/api/promo-codes?${params.toString()}`);
        return response.json();
      } else {
        const response = await apiRequest("GET", "/api/promo-codes");
        return response.json();
      }
    }
  });


  // Extract codes and pagination info
  const codes = Array.isArray(codesResponse) ? codesResponse : codesResponse?.data || [];
  const totalPages = Array.isArray(codesResponse) ? 1 : codesResponse?.totalPages || 1;
  const totalRecords = Array.isArray(codesResponse) ? codesResponse.length : codesResponse?.total || 0;

  // Fetch stats
  const { data: stats = { total: 0, used: 0, available: 0, expired: 0 } } = useQuery<{ total: number; used: number; available: number; expired: number }>({
    queryKey: ["/api/promo-codes/stats"],
  });

  // Fetch campaigns
  const { data: campaigns = [] } = useQuery<string[]>({
    queryKey: ["/api/campaigns"],
  });

  const { data: campaignStats = [] } = useQuery<Array<{ campaignName: string; available: number; used: number; total: number }>>({
    queryKey: ["/api/campaigns/stats"],
  });

  // Generate campaign codes mutation
  const generateCampaignMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        campaignName: campaignName.trim(),
        discountValue: discountValue.trim(),
        count: bulkCount,
        format: codeFormat,
      };

      if (expirationDate) {
        payload.expiresAt = new Date(expirationDate).toISOString();
      }

      const response = await apiRequest("POST", "/api/promo-codes/generate-campaign", payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/promo-codes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/promo-codes/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      setIsCampaignModalOpen(false);
      setCampaignName("");
      setDiscountValue("");
      setExpirationDate("");
      setBulkCount(5);
      toast({
        title: "Campaign Created",
        description: `${bulkCount} promo codes generated for campaign "${campaignName}"!`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create campaign",
        variant: "destructive",
      });
    },
  });

  // Generate single code mutation
  const generateSingleMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        format: codeFormat,
      };

      // Only include optional fields if they have values
      if (campaignName && campaignName.trim()) {
        payload.campaignName = campaignName.trim();
      }
      if (discountValue && discountValue.trim()) {
        payload.discountValue = discountValue.trim();
      }
      if (expirationDate) {
        payload.expiresAt = new Date(expirationDate).toISOString();
      }

      const response = await apiRequest("POST", "/api/promo-codes/generate", payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/promo-codes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/promo-codes/stats"] });
      toast({
        title: "Code Generated",
        description: "Promo code generated successfully!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate promo code",
        variant: "destructive",
      });
    },
  });

  // Generate bulk codes mutation
  const generateBulkMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        count: bulkCount,
        format: codeFormat,
      };

      // Only include optional fields if they have values
      if (campaignName && campaignName.trim()) {
        payload.campaignName = campaignName.trim();
      }
      if (discountValue && discountValue.trim()) {
        payload.discountValue = discountValue.trim();
      }
      if (expirationDate) {
        payload.expiresAt = new Date(expirationDate).toISOString();
      }

      const response = await apiRequest("POST", "/api/promo-codes/generate-bulk", payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/promo-codes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/promo-codes/stats"] });
      toast({
        title: "Bulk Codes Generated",
        description: `${bulkCount} promo codes generated successfully!`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate bulk promo codes",
        variant: "destructive",
      });
    },
  });

  // Redeem code mutation
  const redeemMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await apiRequest("PATCH", `/api/promo-codes/${code}/redeem`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/promo-codes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/promo-codes/stats"] });
      toast({
        title: "Code Redeemed",
        description: "Promo code marked as used successfully!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to redeem promo code. Code may not exist or is already used.",
        variant: "destructive",
      });
    },
  });

  // Toggle code status
  const toggleStatusMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await apiRequest("PATCH", `/api/promo-codes/${code}/toggle-status`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/promo-codes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/promo-codes/stats"] });
      toast({
        title: "Status Updated",
        description: data.message,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to toggle code status",
        variant: "destructive",
      });
    },
  });

  // Delete single code mutation
  const deleteCodeMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await apiRequest("DELETE", `/api/promo-codes/${code}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/promo-codes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/promo-codes/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({
        title: "Code Deleted",
        description: "Promo code deleted successfully!",
      });
      setCodeToDelete(null);
      setIsDeleteConfirmOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete promo code",
        variant: "destructive",
      });
    },
  });

  // Delete multiple codes mutation
  const deleteBulkMutation = useMutation({
    mutationFn: async (codes: string[]) => {
      const response = await apiRequest("DELETE", "/api/promo-codes", { codes });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/promo-codes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/promo-codes/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({
        title: "Codes Deleted",
        description: `${data.deletedCount} promo codes deleted successfully!`,
      });
      setSelectedCodes([]);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete selected promo codes",
        variant: "destructive",
      });
    },
  });

  // Delete all codes mutation for optimization
  const deleteAllCodesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", "/api/promo-codes/all", {});
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/promo-codes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/promo-codes/stats"] });
      setSelectedCodes([]);
      toast({
        title: "All Codes Deleted",
        description: `${data.deletedCount || 'All'} promo codes deleted for performance optimization!`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete all codes",
        variant: "destructive",
      });
    },
  });

  // Advanced bulk delete by filters
  const deleteByFiltersMutation = useMutation({
    mutationFn: async (filters: { campaign?: string; status?: string; discountValue?: string }) => {
      const response = await apiRequest("POST", "/api/promo-codes/delete-by-filters", filters);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/promo-codes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/promo-codes/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns/stats"] });
      setIsAdvancedDeleteOpen(false);
      setDeleteFilterCampaign("");
      setDeleteFilterStatus("");
      setDeleteFilterDiscount("");
      toast({
        title: "Codes Deleted",
        description: `${data.deletedCount} promo codes deleted successfully!`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete promo codes by filters",
        variant: "destructive",
      });
    },
  });

  // Use codes directly from API (already filtered and paginated)
  // No need for client-side filtering since backend handles this
  const filteredCodes = codes;

  // Copy to clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied",
        description: "Code copied to clipboard!",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy code to clipboard",
        variant: "destructive",
      });
    }
  };

  // Format date
  const formatDate = (date: string | Date | null) => {
    if (!date) return "-";
    if (date instanceof Date) {
      return date.toLocaleString();
    }
    return new Date(date).toLocaleString();
  };

  // Download CSV functionality for all codes
  const downloadAllCodesCSV = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("GET", "/api/promo-codes?export=all");
      return response.json();
    },
    onSuccess: (allCodes: PromoCode[]) => {
      // Prepare CSV data with all codes
      const csvData = allCodes.map(code => ({
        Code: code.code,
        Status: code.status,
        Campaign: code.campaignName || '',
        'Discount Value': code.discountValue || '',
        'Created At': formatDate(code.createdAt || null),
        'Used At': formatDate(code.usedAt || null),
        'Expires At': formatDate(code.expiresAt || null)
      }));

      // Create CSV content
      const headers = ['Code', 'Status', 'Campaign', 'Discount Value', 'Created At', 'Used At', 'Expires At'];
      const csvContent = [
        headers.join(','),
        ...csvData.map(row => 
          headers.map(header => {
            const value = row[header as keyof typeof row] || '';
            // Escape commas and quotes in values
            return `"${String(value).replace(/"/g, '""')}"`;
          }).join(',')
        )
      ].join('\n');

      // Create and trigger download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `all-promo-codes-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "All Codes Downloaded",
        description: `${allCodes.length} promo codes exported to CSV!`,
      });
    },
    onError: () => {
      toast({
        title: "Download Failed",
        description: "Failed to download all codes",
        variant: "destructive",
      });
    }
  });

  // Download CSV functionality for current view
  const downloadCurrentPageCSV = () => {
    // Prepare CSV data
    const csvData = codes.map(code => ({
      Code: code.code,
      Status: code.status,
      Campaign: code.campaignName || '',
      'Discount Value': code.discountValue || '',
      'Created At': formatDate(code.createdAt || null),
      'Used At': formatDate(code.usedAt || null),
      'Expires At': formatDate(code.expiresAt || null)
    }));

    // Create CSV content
    const headers = ['Code', 'Status', 'Campaign', 'Discount Value', 'Created At', 'Used At', 'Expires At'];
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => 
        headers.map(header => {
          const value = row[header as keyof typeof row] || '';
          // Escape commas and quotes in values
          return `"${String(value).replace(/"/g, '""')}"`;
        }).join(',')
      )
    ].join('\n');

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `promo-codes-page-${currentPage}-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "CSV Downloaded",
      description: `${codes.length} promo codes exported to CSV!`,
    });
  };

  // Download CSV for selected codes
  const downloadSelectedCodesCSV = () => {
    const selectedCodeData = codes.filter(code => selectedCodes.includes(code.code));
    
    // Prepare CSV data
    const csvData = selectedCodeData.map(code => ({
      Code: code.code,
      Status: code.status,
      Campaign: code.campaignName || '',
      'Discount Value': code.discountValue || '',
      'Created At': formatDate(code.createdAt || null),
      'Used At': formatDate(code.usedAt || null),
      'Expires At': formatDate(code.expiresAt || null)
    }));

    // Create CSV content
    const headers = ['Code', 'Status', 'Campaign', 'Discount Value', 'Created At', 'Used At', 'Expires At'];
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => 
        headers.map(header => {
          const value = row[header as keyof typeof row] || '';
          // Escape commas and quotes in values
          return `"${String(value).replace(/"/g, '""')}"`;
        }).join(',')
      )
    ].join('\n');

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `selected-promo-codes-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Selected Codes Downloaded",
      description: `${selectedCodeData.length} selected promo codes exported to CSV!`,
    });
  };

  // Handle individual code selection
  const handleCodeSelect = (code: string) => {
    if (selectedCodes.includes(code)) {
      setSelectedCodes(selectedCodes.filter(c => c !== code));
    } else {
      setSelectedCodes([...selectedCodes, code]);
    }
  };

  // Handle delete confirmation
  const handleDeleteCode = (code: string) => {
    setCodeToDelete(code);
    setIsDeleteConfirmOpen(true);
  };

  // Confirm delete single code
  const confirmDeleteCode = () => {
    if (codeToDelete) {
      deleteCodeMutation.mutate(codeToDelete);
    }
  };

  // Confirm delete selected codes
  const confirmDeleteSelected = () => {
    if (selectedCodes.length > 0) {
      deleteBulkMutation.mutate(selectedCodes);
    }
  };

  // Handle select all/none for bulk delete
  const handleSelectAll = () => {
    if (selectedCodes.length === codes.length) {
      setSelectedCodes([]);
    } else {
      setSelectedCodes(codes.map(code => code.code));
    }
  };

  // CSV Import functionality
  const importMutation = useMutation({
    mutationFn: async (csvData: string) => {
      // Parse CSV data
      const lines = csvData.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
      
      const codes = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.replace(/"/g, '').trim());
        const codeData: any = {};
        
        headers.forEach((header, index) => {
          const value = values[index] || '';
          switch (header.toLowerCase()) {
            case 'code':
              codeData.code = value;
              break;
            case 'status':
              codeData.status = value || 'unused';
              break;
            case 'campaign':
              if (value) codeData.campaignName = value;
              break;
            case 'discount value':
              if (value) codeData.discountValue = value;
              break;
            case 'used at':
              if (value && value !== '-') codeData.usedAt = new Date(value).toISOString();
              break;
            case 'expires at':
              if (value && value !== '-') codeData.expiresAt = new Date(value).toISOString();
              break;
          }
        });
        
        return codeData;
      }).filter(code => code.code); // Filter out empty codes

      const response = await apiRequest("POST", "/api/promo-codes/import", { codes });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/promo-codes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/promo-codes/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      setIsImportModalOpen(false);
      setImportFile(null);
      toast({
        title: "Import Successful",
        description: `${data.imported} codes imported, ${data.skipped} skipped, ${data.errors.length} errors`,
      });
    },
    onError: () => {
      toast({
        title: "Import Failed",
        description: "Failed to import CSV data. Please check the format.",
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/csv') {
      setImportFile(file);
    } else {
      toast({
        title: "Invalid File",
        description: "Please select a valid CSV file.",
        variant: "destructive",
      });
    }
  };

  const handleImport = () => {
    if (!importFile) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const csvData = e.target?.result as string;
      importMutation.mutate(csvData);
    };
    reader.readAsText(importFile);
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="bg-primary text-white p-2 rounded-lg">
                <Ticket className="text-xl" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">PromoGen</h1>
                <p className="text-sm text-gray-500">Code Generator & Tracker</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                onClick={() => setShowTokenManager(!showTokenManager)}
                data-testid="button-toggle-tokens"
              >
                <Settings className="h-4 w-4 mr-2" />
                {showTokenManager ? 'Hide Tokens' : 'API Tokens'}
              </Button>
              {/* Generate Code Button with Dropdown */}
              <div className="flex items-center space-x-2">
                <Dialog open={isGenerateModalOpen} onOpenChange={setIsGenerateModalOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-primary hover:bg-blue-700">
                      <Plus className="mr-2 h-4 w-4" />
                      Quick Generate
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Quick Code Generation</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="quickCodeFormat">Code Format</Label>
                          <Input
                            id="quickCodeFormat"
                            placeholder="e.g., PROMO-XXXX, SAVE-XX-XX"
                            value={codeFormat}
                            onChange={(e) => setCodeFormat(e.target.value)}
                            data-testid="input-code-format"
                            className="font-mono"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Use X for random characters
                          </p>
                        </div>
                        <div>
                          <Label>Quantity</Label>
                          <Input
                            type="number"
                            min="1"
                            max="5000"
                            value={bulkCount}
                            onChange={(e) => setBulkCount(Number(e.target.value))}
                            data-testid="input-quantity"
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="quickCampaignName">Campaign Name (Optional)</Label>
                          <Input
                            id="quickCampaignName"
                            placeholder="e.g., Spring Sale"
                            value={campaignName}
                            onChange={(e) => setCampaignName(e.target.value)}
                            data-testid="input-campaign-name"
                          />
                        </div>
                        <div>
                          <Label htmlFor="quickDiscountValue">Discount Value (Optional)</Label>
                          <Input
                            id="quickDiscountValue"
                            placeholder="e.g., 20% off, $10 off"
                            value={discountValue}
                            onChange={(e) => setDiscountValue(e.target.value)}
                            data-testid="input-discount-value"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <Label htmlFor="quickExpirationDate">Expiration Date (Optional)</Label>
                        <Input
                          id="quickExpirationDate"
                          type="date"
                          value={expirationDate}
                          onChange={(e) => setExpirationDate(e.target.value)}
                          data-testid="input-expiration-date"
                        />
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setCampaignName("");
                            setDiscountValue("");
                            setExpirationDate("");
                            setBulkCount(1);
                            setCodeFormat("PROMO-XXXX");
                          }}
                          className="flex-1"
                          data-testid="button-reset-form"
                        >
                          Reset
                        </Button>
                        <Button
                          onClick={() => {
                            if (bulkCount === 1) {
                              generateSingleMutation.mutate();
                            } else {
                              generateBulkMutation.mutate();
                            }
                            setIsGenerateModalOpen(false);
                          }}
                          disabled={generateSingleMutation.isPending || generateBulkMutation.isPending}
                          className="flex-[2] bg-primary hover:bg-blue-700"
                          data-testid="button-generate-codes"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          {(generateSingleMutation.isPending || generateBulkMutation.isPending) 
                            ? "Generating..." 
                            : `Generate ${bulkCount} Code${bulkCount > 1 ? 's' : ''}`
                          }
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                
                <Dialog open={isCampaignModalOpen} onOpenChange={setIsCampaignModalOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="border-secondary text-secondary hover:bg-secondary hover:text-white">
                      <Layers className="mr-2 h-4 w-4" />
                      New Campaign
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Create Promotional Campaign</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="campaignName">Campaign Name *</Label>
                          <Input
                            id="campaignName"
                            placeholder="Summer Sale 2025"
                            value={campaignName}
                            onChange={(e) => setCampaignName(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="discountValue">Discount Value *</Label>
                          <Input
                            id="discountValue"
                            placeholder="20% off, $10 off, etc."
                            value={discountValue}
                            onChange={(e) => setDiscountValue(e.target.value)}
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label htmlFor="campaignCodeFormat">Code Format</Label>
                          <Input
                            id="campaignCodeFormat"
                            placeholder="e.g., SUMMER-XXXX"
                            value={codeFormat}
                            onChange={(e) => setCodeFormat(e.target.value)}
                            className="font-mono"
                            data-testid="input-campaign-code-format"
                          />
                        </div>
                        <div>
                          <Label>Quantity</Label>
                          <Input
                            type="number"
                            min="1"
                            max="5000"
                            value={bulkCount}
                            onChange={(e) => setBulkCount(Number(e.target.value))}
                          />
                        </div>
                        <div>
                          <Label>Expires (Optional)</Label>
                          <Input
                            type="date"
                            value={expirationDate}
                            onChange={(e) => setExpirationDate(e.target.value)}
                          />
                        </div>
                      </div>
                      
                      <Button
                        onClick={() => generateCampaignMutation.mutate()}
                        disabled={!campaignName || !discountValue || generateCampaignMutation.isPending}
                        className="w-full bg-secondary hover:bg-green-700"
                      >
                        <Layers className="mr-2 h-4 w-4" />
                        Create Campaign ({bulkCount} codes)
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Token Manager Section */}
      {showTokenManager && (
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <TokenManager />
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Advanced Tools Section */}
        <div className="mb-8">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <Settings className="mr-2 h-5 w-5" />
                  Advanced Tools
                </CardTitle>
                <Checkbox
                  id="show-advanced"
                  checked={showAdvancedTools}
                  onCheckedChange={(checked) => setShowAdvancedTools(!!checked)}
                  className="mr-2"
                />
                <Label htmlFor="show-advanced" className="text-sm cursor-pointer">
                  {showAdvancedTools ? 'Hide' : 'Show'} Tools
                </Label>
              </div>
            </CardHeader>
            {showAdvancedTools && (
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Pagination Toggle */}
                  <div className="flex items-center space-x-2 p-3 bg-blue-50 rounded-lg">
                    <Checkbox
                      id="pagination-toggle"
                      checked={usePagination}
                      onCheckedChange={(checked) => {
                        setUsePagination(!!checked);
                        setCurrentPage(1);
                      }}
                      data-testid="checkbox-pagination"
                    />
                    <Label htmlFor="pagination-toggle" className="text-sm">
                      Use Pagination ({totalRecords > 1000 ? 'Recommended' : 'Optional'})
                    </Label>
                  </div>
                  
                  {/* CSV Downloads */}
                  <div className="space-y-2 p-3 bg-green-50 rounded-lg">
                    <h4 className="text-sm font-medium text-green-800">Export Data</h4>
                    <div className="flex flex-col gap-2">
                      <Button
                        onClick={downloadCurrentPageCSV}
                        variant="outline"
                        size="sm"
                        disabled={codes.length === 0}
                        className="border-green-300 text-green-600 hover:bg-green-100 text-xs h-8"
                        data-testid="button-download-current"
                      >
                        <Download className="mr-1 h-3 w-3" />
                        Page CSV ({codes.length})
                      </Button>
                      <Button
                        onClick={() => downloadAllCodesCSV.mutate()}
                        variant="outline"
                        size="sm"
                        disabled={downloadAllCodesCSV.isPending}
                        className="border-blue-300 text-blue-600 hover:bg-blue-100 text-xs h-8"
                        data-testid="button-download-all"
                      >
                        <Download className="mr-1 h-3 w-3" />
                        {downloadAllCodesCSV.isPending ? "Downloading..." : `All CSV (${stats.total})`}
                      </Button>
                      {selectedCodes.length > 0 && (
                        <Button
                          onClick={downloadSelectedCodesCSV}
                          variant="outline"
                          size="sm"
                          className="border-purple-300 text-purple-600 hover:bg-purple-100 text-xs h-8"
                          data-testid="button-download-selected"
                        >
                          <Download className="mr-1 h-3 w-3" />
                          Selected CSV ({selectedCodes.length})
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {/* Import Tools */}
                  <div className="space-y-2 p-3 bg-yellow-50 rounded-lg">
                    <h4 className="text-sm font-medium text-yellow-800">Import Data</h4>
                    <div className="space-y-2">
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="csv-upload"
                        data-testid="input-csv-file"
                      />
                      <Label htmlFor="csv-upload" className="cursor-pointer">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-yellow-300 text-yellow-600 hover:bg-yellow-100 text-xs h-8 w-full"
                          data-testid="button-select-csv"
                          asChild
                        >
                          <span>
                            <Upload className="mr-1 h-3 w-3" />
                            Select CSV
                          </span>
                        </Button>
                      </Label>
                      {importFile && (
                        <Button
                          onClick={handleImport}
                          disabled={importMutation.isPending}
                          size="sm"
                          className="bg-yellow-600 hover:bg-yellow-700 text-xs h-8 w-full"
                          data-testid="button-import-csv"
                        >
                          <Upload className="mr-1 h-3 w-3" />
                          {importMutation.isPending ? "Importing..." : "Import CSV"}
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {/* Advanced Bulk Delete */}
                  <div className="space-y-2 p-3 bg-orange-50 rounded-lg">
                    <h4 className="text-sm font-medium text-orange-800">Advanced Bulk Delete</h4>
                    <Dialog 
                      open={isAdvancedDeleteOpen} 
                      onOpenChange={(open) => {
                        setIsAdvancedDeleteOpen(open);
                        if (!open) setDeleteConfirmText(""); // Clear when dialog closes
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-orange-300 text-orange-600 hover:bg-orange-100 text-xs h-8 w-full"
                          data-testid="button-advanced-delete"
                        >
                          <Filter className="mr-1 h-3 w-3" />
                          Delete by Filters
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md" data-testid="dialog-advanced-delete">
                        <DialogHeader>
                          <DialogTitle data-testid="title-advanced-delete">Advanced Bulk Delete</DialogTitle>
                          <DialogDescription data-testid="description-advanced-delete">
                            Delete promo codes based on campaign, status, or discount value. At least one filter is required.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          {/* Campaign Filter */}
                          <div className="space-y-2">
                            <Label htmlFor="delete-campaign" data-testid="label-delete-campaign">Campaign Name (optional)</Label>
                            <Select value={deleteFilterCampaign} onValueChange={setDeleteFilterCampaign}>
                              <SelectTrigger id="delete-campaign" data-testid="select-delete-campaign">
                                <SelectValue placeholder="Select campaign to delete..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all" data-testid="option-all-campaigns">All Campaigns</SelectItem>
                                {campaigns.map((campaign) => (
                                  <SelectItem key={campaign} value={campaign} data-testid={`option-campaign-${campaign}`}>
                                    {campaign}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Status Filter */}
                          <div className="space-y-2">
                            <Label htmlFor="delete-status" data-testid="label-delete-status">Status (optional)</Label>
                            <Select value={deleteFilterStatus} onValueChange={setDeleteFilterStatus}>
                              <SelectTrigger id="delete-status" data-testid="select-delete-status">
                                <SelectValue placeholder="Select status to delete..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unused" data-testid="option-unused">Unused</SelectItem>
                                <SelectItem value="used" data-testid="option-used">Used</SelectItem>
                                <SelectItem value="expired" data-testid="option-expired">Expired</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Discount Value Filter */}
                          <div className="space-y-2">
                            <Label htmlFor="delete-discount" data-testid="label-delete-discount">Discount Value (optional)</Label>
                            <Input
                              id="delete-discount"
                              placeholder="e.g., 10%, $50, TESTCODE"
                              value={deleteFilterDiscount}
                              onChange={(e) => setDeleteFilterDiscount(e.target.value)}
                              data-testid="input-delete-discount"
                            />
                          </div>

                          {/* Preview Info */}
                          {(deleteFilterCampaign || deleteFilterStatus || deleteFilterDiscount) && (
                            <div className="p-3 bg-orange-50 rounded border border-orange-200" data-testid="preview-filters">
                              <p className="text-sm text-orange-800 font-medium mb-1">Filters to apply:</p>
                              <ul className="text-xs text-orange-700 space-y-1">
                                {deleteFilterCampaign && deleteFilterCampaign !== 'all' && (
                                  <li data-testid="preview-campaign">• Campaign: <strong>{deleteFilterCampaign}</strong></li>
                                )}
                                {deleteFilterStatus && (
                                  <li data-testid="preview-status">• Status: <strong>{deleteFilterStatus}</strong></li>
                                )}
                                {deleteFilterDiscount && (
                                  <li data-testid="preview-discount">• Discount: <strong>{deleteFilterDiscount}</strong></li>
                                )}
                              </ul>
                            </div>
                          )}
                        </div>
                        <DialogFooter className="gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setDeleteFilterCampaign("");
                              setDeleteFilterStatus("");
                              setDeleteFilterDiscount("");
                            }}
                            data-testid="button-clear-filters"
                          >
                            Clear Filters
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                type="button"
                                variant="destructive"
                                disabled={!deleteFilterCampaign && !deleteFilterStatus && !deleteFilterDiscount}
                                data-testid="button-show-confirmation"
                              >
                                Preview Deletion
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent data-testid="alert-confirm-delete">
                              <AlertDialogHeader>
                                <AlertDialogTitle data-testid="alert-title">Confirm Deletion</AlertDialogTitle>
                                <AlertDialogDescription data-testid="alert-description">
                                  You are about to permanently delete promo codes matching these filters:
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <div className="space-y-4">
                                <div className="p-4 bg-red-50 rounded border border-red-200" data-testid="confirmation-summary">
                                  <ul className="text-sm space-y-2">
                                    {deleteFilterCampaign && deleteFilterCampaign !== 'all' && (
                                      <li data-testid="confirm-campaign">
                                        <strong>Campaign:</strong> {deleteFilterCampaign}
                                      </li>
                                    )}
                                    {deleteFilterStatus && (
                                      <li data-testid="confirm-status">
                                        <strong>Status:</strong> {deleteFilterStatus}
                                      </li>
                                    )}
                                    {deleteFilterDiscount && (
                                      <li data-testid="confirm-discount">
                                        <strong>Discount Value:</strong> {deleteFilterDiscount}
                                      </li>
                                    )}
                                  </ul>
                                  <p className="mt-3 text-xs text-red-700" data-testid="warning-text">
                                    ⚠️ This action cannot be undone. All codes matching these filters will be permanently deleted.
                                  </p>
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="confirm-delete-text" className="text-sm font-medium" data-testid="label-confirm-text">
                                    Type <strong className="text-red-600">DELETE</strong> to confirm:
                                  </Label>
                                  <Input
                                    id="confirm-delete-text"
                                    value={deleteConfirmText}
                                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                                    placeholder="Type DELETE"
                                    className="font-mono"
                                    data-testid="input-confirm-delete"
                                  />
                                </div>
                              </div>
                              <AlertDialogFooter>
                                <AlertDialogCancel 
                                  onClick={() => setDeleteConfirmText("")}
                                  data-testid="button-cancel-delete"
                                >
                                  Cancel
                                </AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => {
                                    deleteByFiltersMutation.mutate({
                                      campaign: deleteFilterCampaign && deleteFilterCampaign !== 'all' ? deleteFilterCampaign : undefined,
                                      status: deleteFilterStatus || undefined,
                                      discountValue: deleteFilterDiscount || undefined,
                                    });
                                    setDeleteConfirmText(""); // Clear after mutation
                                  }}
                                  disabled={deleteConfirmText !== "DELETE" || deleteByFiltersMutation.isPending}
                                  className="bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                  data-testid="button-final-confirm-delete"
                                >
                                  {deleteByFiltersMutation.isPending ? "Deleting..." : "Yes, Delete Codes"}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {/* Bulk Operations */}
                  {stats.total > 1000 && (
                    <div className="space-y-2 p-3 bg-red-50 rounded-lg">
                      <h4 className="text-sm font-medium text-red-800">Bulk Operations</h4>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-red-300 text-red-600 hover:bg-red-100 text-xs h-8 w-full"
                            data-testid="button-delete-all"
                          >
                            <Trash2 className="mr-1 h-3 w-3" />
                            Clear All ({stats.total})
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete All Promo Codes</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete all {stats.total} promo codes from the database for performance optimization. 
                              This action cannot be undone. Make sure to download a backup first!
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => deleteAllCodesMutation.mutate()}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Delete All {stats.total} Codes
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Redeem Code Section */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Redeem Code</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Redeem Code Form */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="redeemCode">Enter Promo Code</Label>
                    <Input
                      id="redeemCode"
                      placeholder="PROMO-XXXX"
                      value={redeemCode}
                      onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                      className="font-mono"
                    />
                  </div>
                  
                  <Button
                    onClick={() => {
                      redeemMutation.mutate(redeemCode);
                      setRedeemCode("");
                    }}
                    disabled={!redeemCode || redeemMutation.isPending}
                    className="w-full bg-accent hover:bg-orange-600"
                  >
                    <Ticket className="mr-2 h-4 w-4" />
                    Redeem Code
                  </Button>
                </div>

                {/* Quick Stats */}
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-md font-medium text-gray-900 mb-4">Campaign Stats</h3>
                  {campaignStats.length === 0 ? (
                    <div className="text-center py-4 text-gray-500">
                      <p className="text-sm">No campaigns yet</p>
                      <p className="text-xs">Create codes with campaign names to see stats</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {campaignStats.map((campaign) => (
                        <div key={campaign.campaignName} className="bg-gray-50 rounded-lg p-3">
                          <div className="text-sm font-medium text-gray-900 mb-2 truncate">
                            {campaign.campaignName}
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div className="text-center">
                              <div className="text-lg font-bold text-blue-600">{campaign.total}</div>
                              <div className="text-blue-700">Total</div>
                            </div>
                            <div className="text-center">
                              <div className="text-lg font-bold text-green-600">{campaign.available}</div>
                              <div className="text-green-700">Available</div>
                            </div>
                            <div className="text-center">
                              <div className="text-lg font-bold text-red-600">{campaign.used}</div>
                              <div className="text-red-700">Used</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Code Tracker */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <CardTitle>Code Tracker</CardTitle>
                    
                    <div className="flex flex-col sm:flex-row gap-3">
                      {/* Search */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <Input
                          placeholder="Search codes or campaigns..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10 w-full sm:w-64"
                        />
                      </div>
                      
                      {/* Campaign Filter */}
                      <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                        <SelectTrigger className="w-full sm:w-40">
                          <SelectValue placeholder="All Campaigns" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Campaigns</SelectItem>
                          {campaigns.map((campaign) => (
                            <SelectItem key={campaign} value={campaign}>
                              {campaign}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      {/* Status Filter */}
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-full sm:w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="unused">Available</SelectItem>
                          <SelectItem value="used">Redeemed</SelectItem>
                          <SelectItem value="expired">Expired</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      {/* Discount Filter */}
                      <Input
                        placeholder="Filter by discount..."
                        value={discountFilter}
                        onChange={(e) => setDiscountFilter(e.target.value)}
                        className="w-full sm:w-40"
                        data-testid="input-discount-filter"
                      />

                    </div>
                  </div>
                  
                  {/* Statistics Overview */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-4 border-t border-gray-200">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="text-xl font-bold text-blue-600">{stats.total}</div>
                      <div className="text-xs text-blue-700">Total Generated</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-xl font-bold text-green-600">{stats.available}</div>
                      <div className="text-xs text-green-700">Available</div>
                    </div>
                    <div className="text-center p-3 bg-red-50 rounded-lg">
                      <div className="text-xl font-bold text-red-600">{stats.used}</div>
                      <div className="text-xs text-red-700">Redeemed</div>
                    </div>
                    <div className="text-center p-3 bg-orange-50 rounded-lg">
                      <div className="text-xl font-bold text-orange-600">{stats.expired}</div>
                      <div className="text-xs text-orange-700">Expired</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="text-xl font-bold text-gray-600">{stats.used > 0 ? Math.round((stats.used / stats.total) * 100) : 0}%</div>
                      <div className="text-xs text-gray-700">Redemption Rate</div>
                    </div>
                  </div>
                </div>
              </CardHeader>

              {/* Bulk Actions Bar */}
              {selectedCodes.length > 0 && (
                <div className="bg-blue-50 border-b border-blue-200 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-sm text-blue-800 font-medium">
                        {selectedCodes.length} code{selectedCodes.length > 1 ? 's' : ''} selected
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedCodes([])}
                        className="text-blue-600 hover:text-blue-800 p-0 h-auto text-xs"
                      >
                        Clear selection
                      </Button>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={deleteBulkMutation.isPending}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Selected ({selectedCodes.length})
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Selected Codes</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete {selectedCodes.length} promo code{selectedCodes.length > 1 ? 's' : ''}? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={confirmDeleteSelected}>
                            Delete {selectedCodes.length} Code{selectedCodes.length > 1 ? 's' : ''}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              )}

              {/* Codes Table */}
              <CardContent className="p-0">
                <div>
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left">
                          <Checkbox
                            checked={codes.length > 0 && selectedCodes.length === codes.length}
                            onCheckedChange={handleSelectAll}
                            className="mr-2"
                          />
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Campaign</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Discount</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expires</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {isLoadingCodes ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-4 text-center text-gray-500">
                            Loading codes...
                          </td>
                        </tr>
                      ) : codesError ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-4 text-center">
                            <div className="text-red-600">
                              <p className="font-medium">Error loading codes</p>
                              <p className="text-sm mt-1">{codesError.message}</p>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="mt-2"
                                onClick={() => window.location.reload()}
                              >
                                Reload Page
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ) : codes.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-4 text-center text-gray-500">
                            {codes.length === 0 ? "No codes generated yet. Create your first campaign!" : "No codes found"}
                          </td>
                        </tr>
                      ) : (
                        codes.map((code: PromoCode) => {
                          const isExpired = code.expiresAt && new Date(code.expiresAt) < new Date();
                          const effectiveStatus = isExpired && code.status === "unused" ? "expired" : code.status;
                          
                          return (
                            <tr key={code.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <Checkbox
                                  checked={selectedCodes.includes(code.code)}
                                  onCheckedChange={() => handleCodeSelect(code.code)}
                                />
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center space-x-2">
                                  <span className="font-mono text-sm font-medium text-gray-900">
                                    {code.code}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => copyToClipboard(code.code)}
                                    className="p-1 h-auto text-gray-400 hover:text-gray-600"
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {code.campaignName || 
                                  <span className="text-gray-400 italic">No campaign</span>
                                }
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {code.discountValue || 
                                  <span className="text-gray-400">-</span>
                                }
                              </td>
                              <td className="px-4 py-3">
                                <Badge
                                  variant={effectiveStatus === "unused" ? "default" : "secondary"}
                                  className={
                                    effectiveStatus === "unused"
                                      ? "bg-green-100 text-green-800 hover:bg-green-100"
                                      : effectiveStatus === "used"
                                      ? "bg-red-100 text-red-800 hover:bg-red-100"
                                      : "bg-orange-100 text-orange-800 hover:bg-orange-100"
                                  }
                                >
                                  {effectiveStatus === "unused" ? "Available" : 
                                   effectiveStatus === "used" ? "Redeemed" : "Expired"}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {code.expiresAt ? formatDate(code.expiresAt.toString()) : 
                                  <span className="text-gray-400">No expiry</span>
                                }
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {formatDate(code.createdAt.toString())}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center space-x-2">
                                  {effectiveStatus !== "expired" ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => toggleStatusMutation.mutate(code.code)}
                                      disabled={toggleStatusMutation.isPending}
                                      className="text-blue-600 hover:text-blue-700 p-0 h-auto text-xs"
                                      data-testid={`button-toggle-${code.code}`}
                                    >
                                      {effectiveStatus === "unused" ? "Mark Used" : "Mark Unused"}
                                    </Button>
                                  ) : (
                                    <span className="text-gray-400 text-xs">Expired</span>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteCode(code.code)}
                                    disabled={deleteCodeMutation.isPending}
                                    className="text-red-600 hover:text-red-800 p-0 h-auto"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {codes.length > 0 && (
                  <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
                    {usePagination ? (
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-600">
                          Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalRecords)} of {totalRecords} codes
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                            disabled={currentPage <= 1}
                            data-testid="button-prev-page"
                          >
                            Previous
                          </Button>
                          <span className="text-sm text-gray-600">
                            Page {currentPage} of {totalPages}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                            disabled={currentPage >= totalPages}
                            data-testid="button-next-page"
                          >
                            Next
                          </Button>
                          <Select 
                            value={itemsPerPage.toString()} 
                            onValueChange={(value) => {
                              setItemsPerPage(Number(value));
                              setCurrentPage(1);
                            }}
                          >
                            <SelectTrigger className="w-20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="50">50</SelectItem>
                              <SelectItem value="100">100</SelectItem>
                              <SelectItem value="200">200</SelectItem>
                              <SelectItem value="500">500</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-600">
                        Showing all {codes.length} codes {totalRecords > 1000 && (
                          <span className="text-amber-600 font-medium">(Consider enabling pagination for better performance)</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
              <AlertTriangle className="mr-2 h-5 w-5 text-red-600" />
              Delete Promo Code
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the promo code <strong>{codeToDelete}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setCodeToDelete(null); setIsDeleteConfirmOpen(false); }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteCode}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Code
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
