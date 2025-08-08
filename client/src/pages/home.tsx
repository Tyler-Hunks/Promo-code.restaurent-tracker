import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Copy, Ticket, Plus, Layers, Search, Trash2, AlertTriangle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import type { PromoCode, BulkGenerate, CampaignGenerate } from "@shared/schema";

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
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [codeToDelete, setCodeToDelete] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch all promo codes
  const { data: codes = [], isLoading: isLoadingCodes } = useQuery<PromoCode[]>({
    queryKey: ["/api/promo-codes"],
  });

  // Fetch stats
  const { data: stats = { total: 0, used: 0, available: 0, expired: 0 } } = useQuery<{ total: number; used: number; available: number; expired: number }>({
    queryKey: ["/api/promo-codes/stats"],
  });

  // Fetch campaigns
  const { data: campaigns = [] } = useQuery<string[]>({
    queryKey: ["/api/campaigns"],
  });

  // Generate campaign codes mutation
  const generateCampaignMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/promo-codes/generate-campaign", {
        campaignName,
        discountValue,
        count: bulkCount,
        format: codeFormat,
        expiresAt: expirationDate ? new Date(expirationDate).toISOString() : undefined,
      });
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
      const response = await apiRequest("POST", "/api/promo-codes/generate", {
        format: codeFormat,
        campaignName: campaignName || undefined,
        discountValue: discountValue || undefined,
        expiresAt: expirationDate ? new Date(expirationDate).toISOString() : undefined,
      });
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
      const response = await apiRequest("POST", "/api/promo-codes/generate-bulk", {
        count: bulkCount,
        format: codeFormat,
        campaignName: campaignName || undefined,
        discountValue: discountValue || undefined,
        expiresAt: expirationDate ? new Date(expirationDate).toISOString() : undefined,
      });
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

  // Mark code as used
  const markAsUsedMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await apiRequest("PATCH", `/api/promo-codes/${code}/redeem`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/promo-codes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/promo-codes/stats"] });
      toast({
        title: "Code Marked as Used",
        description: "Promo code status updated successfully!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to mark code as used",
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

  // Filter codes based on search, status, and campaign
  const filteredCodes = codes.filter((code: PromoCode) => {
    const matchesSearch = code.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (code.campaignName && code.campaignName.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === "all" || code.status === statusFilter;
    const matchesCampaign = selectedCampaign === "all" || code.campaignName === selectedCampaign;
    return matchesSearch && matchesStatus && matchesCampaign;
  });

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
  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleString();
  };

  // Handle select all/none for bulk delete
  const handleSelectAll = () => {
    if (selectedCodes.length === filteredCodes.length) {
      setSelectedCodes([]);
    } else {
      setSelectedCodes(filteredCodes.map(code => code.code));
    }
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
              {/* Generate Code Button with Dropdown */}
              <div className="flex items-center space-x-2">
                <Dialog open={isGenerateModalOpen} onOpenChange={setIsGenerateModalOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-primary hover:bg-blue-700">
                      <Plus className="mr-2 h-4 w-4" />
                      Quick Generate
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Quick Code Generation</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Format</Label>
                          <Select value={codeFormat} onValueChange={setCodeFormat}>
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PROMO-XXXX">PROMO-XXXX</SelectItem>
                              <SelectItem value="SAVE-XXXX-XX">SAVE-XXXX-XX</SelectItem>
                              <SelectItem value="DISCOUNT-XXXXXX">DISCOUNT-XXXXXX</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Count</Label>
                          <Input
                            type="number"
                            min="1"
                            max="20"
                            value={bulkCount}
                            onChange={(e) => setBulkCount(Number(e.target.value))}
                            className="h-8"
                          />
                        </div>
                      </div>
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
                        className="w-full bg-primary hover:bg-blue-700"
                      >
                        Generate {bulkCount} Code{bulkCount > 1 ? 's' : ''}
                      </Button>
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
                          <Label>Code Format</Label>
                          <Select value={codeFormat} onValueChange={setCodeFormat}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PROMO-XXXX">PROMO-XXXX</SelectItem>
                              <SelectItem value="SAVE-XXXX-XX">SAVE-XXXX-XX</SelectItem>
                              <SelectItem value="DISCOUNT-XXXXXX">DISCOUNT-XXXXXX</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Quantity</Label>
                          <Input
                            type="number"
                            min="1"
                            max="100"
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                  <h3 className="text-md font-medium text-gray-900 mb-4">Quick Stats</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{stats.available}</div>
                      <div className="text-sm text-green-700">Available</div>
                    </div>
                    <div className="text-center p-3 bg-red-50 rounded-lg">
                      <div className="text-2xl font-bold text-red-600">{stats.used}</div>
                      <div className="text-sm text-red-700">Used</div>
                    </div>
                  </div>
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
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left">
                          <Checkbox
                            checked={filteredCodes.length > 0 && selectedCodes.length === filteredCodes.length}
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
                      ) : filteredCodes.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-4 text-center text-gray-500">
                            {codes.length === 0 ? "No codes generated yet. Create your first campaign!" : "No codes match your filters"}
                          </td>
                        </tr>
                      ) : (
                        filteredCodes.map((code: PromoCode) => {
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
                                      ? "bg-blue-100 text-blue-800 hover:bg-blue-100"
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
                                  {effectiveStatus === "unused" ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => markAsUsedMutation.mutate(code.code)}
                                      disabled={markAsUsedMutation.isPending}
                                      className="text-accent hover:text-orange-700 p-0 h-auto text-xs"
                                    >
                                      Mark Used
                                    </Button>
                                  ) : (
                                    <span className="text-gray-400 text-xs">
                                      {effectiveStatus === "used" ? formatDate(code.usedAt?.toString() || null) : "Expired"}
                                    </span>
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

                {/* Pagination placeholder */}
                {filteredCodes.length > 0 && (
                  <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
                    <div className="text-sm text-gray-600">
                      Showing {filteredCodes.length} of {codes.length} codes
                    </div>
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
