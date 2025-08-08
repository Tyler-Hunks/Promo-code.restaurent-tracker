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
import { Copy, Ticket, Plus, Layers, Search } from "lucide-react";
import type { PromoCode } from "@shared/schema";

export default function Home() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [codeFormat, setCodeFormat] = useState("PROMO-XXXX");
  const [bulkCount, setBulkCount] = useState(5);
  const [redeemCode, setRedeemCode] = useState("");
  const [isRedeemModalOpen, setIsRedeemModalOpen] = useState(false);
  const { toast } = useToast();

  // Fetch all promo codes
  const { data: codes = [], isLoading: isLoadingCodes } = useQuery({
    queryKey: ["/api/promo-codes"],
  });

  // Fetch stats
  const { data: stats = { total: 0, used: 0, available: 0 } } = useQuery({
    queryKey: ["/api/promo-codes/stats"],
  });

  // Generate single code mutation
  const generateSingleMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/promo-codes/generate", {
        format: codeFormat,
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
      setIsRedeemModalOpen(false);
      setRedeemCode("");
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

  // Filter codes based on search and status
  const filteredCodes = codes.filter((code: PromoCode) => {
    const matchesSearch = code.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || code.status === statusFilter;
    return matchesSearch && matchesStatus;
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
              <div className="text-sm text-gray-600">
                <span>{stats.total}</span> Total Codes
              </div>
              <div className="text-sm text-gray-600">
                <span>{stats.used}</span> Used
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Code Generator */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Generate Codes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Single Code Generation */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="codeFormat">Code Format</Label>
                    <Select value={codeFormat} onValueChange={setCodeFormat}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PROMO-XXXX">PROMO-XXXX (8 chars)</SelectItem>
                        <SelectItem value="SAVE-XXXX-XX">SAVE-XXXX-XX (10 chars)</SelectItem>
                        <SelectItem value="DISCOUNT-XXXXXX">DISCOUNT-XXXXXX (14 chars)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Button
                    onClick={() => generateSingleMutation.mutate()}
                    disabled={generateSingleMutation.isPending}
                    className="w-full bg-primary hover:bg-blue-700"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Generate Single Code
                  </Button>
                </div>

                {/* Bulk Generation */}
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-md font-medium text-gray-900 mb-4">Bulk Generation</h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="bulkCount">Number of Codes</Label>
                      <Input
                        id="bulkCount"
                        type="number"
                        min="1"
                        max="100"
                        value={bulkCount}
                        onChange={(e) => setBulkCount(Number(e.target.value))}
                      />
                    </div>
                    
                    <Button
                      onClick={() => generateBulkMutation.mutate()}
                      disabled={generateBulkMutation.isPending}
                      className="w-full bg-secondary hover:bg-green-700"
                    >
                      <Layers className="mr-2 h-4 w-4" />
                      Generate Bulk Codes
                    </Button>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="border-t border-gray-200 pt-6">
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
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <CardTitle>Code Tracker</CardTitle>
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        placeholder="Search codes..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 w-full sm:w-64"
                      />
                    </div>
                    
                    {/* Status Filter */}
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-full sm:w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="unused">Unused Only</SelectItem>
                        <SelectItem value="used">Used Only</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Redeem Code Dialog */}
                    <Dialog open={isRedeemModalOpen} onOpenChange={setIsRedeemModalOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="text-accent border-accent hover:bg-accent hover:text-white">
                          Redeem Code
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Redeem Code</DialogTitle>
                        </DialogHeader>
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
                          <div className="flex space-x-3">
                            <Button
                              variant="outline"
                              onClick={() => setIsRedeemModalOpen(false)}
                              className="flex-1"
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={() => redeemMutation.mutate(redeemCode)}
                              disabled={!redeemCode || redeemMutation.isPending}
                              className="flex-1 bg-primary hover:bg-blue-700"
                            >
                              Redeem Code
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardHeader>

              {/* Codes Table */}
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Used Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {isLoadingCodes ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                            Loading codes...
                          </td>
                        </tr>
                      ) : filteredCodes.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                            {codes.length === 0 ? "No codes generated yet" : "No codes match your filters"}
                          </td>
                        </tr>
                      ) : (
                        filteredCodes.map((code: PromoCode) => (
                          <tr key={code.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <div className="flex items-center space-x-3">
                                <span className="font-mono text-sm font-medium text-gray-900">
                                  {code.code}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyToClipboard(code.code)}
                                  className="p-1 h-auto text-gray-400 hover:text-gray-600"
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <Badge
                                variant={code.status === "unused" ? "default" : "secondary"}
                                className={
                                  code.status === "unused"
                                    ? "bg-green-100 text-green-800 hover:bg-green-100"
                                    : "bg-red-100 text-red-800 hover:bg-red-100"
                                }
                              >
                                {code.status === "unused" ? "Unused" : "Used"}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {formatDate(code.createdAt.toString())}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-400">
                              {formatDate(code.usedAt?.toString() || null)}
                            </td>
                            <td className="px-6 py-4">
                              {code.status === "unused" ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => markAsUsedMutation.mutate(code.code)}
                                  disabled={markAsUsedMutation.isPending}
                                  className="text-accent hover:text-orange-700 p-0 h-auto"
                                >
                                  Mark as Used
                                </Button>
                              ) : (
                                <span className="text-gray-400 text-sm">Redeemed</span>
                              )}
                            </td>
                          </tr>
                        ))
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
    </div>
  );
}
