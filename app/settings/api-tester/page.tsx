"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { toast } from "sonner";
import {
  Play,
  Save,
  Trash2,
  Copy,
  CheckCircle2,
  Terminal,
  Send,
  Clock,
  AlertCircle,
  Database,
  Code,
  History,
  Plus,
  X,
  Download,
  FileJson,
  LayoutGrid,
  Globe,
  Settings,
  ChevronDown,
  ChevronRight,
  RefreshCw,

} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

// Types
interface ApiRequest {
  id: string;
  name: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
  timestamp: string;
}

interface ApiResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: any;
  time: number;
  size: string;
}

interface SavedRequest {
  id: string;
  name: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
  createdAt: string;
}

// Default API token
const DEFAULT_API_TOKEN = "esp_feb14de9263c84b53a5293464ed277c4207c2e4e9678761d3abc4f12679f0714";

export default function ApiTesterPage() {
  const router = useRouter();
  
  // Request State
  const [method, setMethod] = useState("POST");
  const [url, setUrl] = useState("/api/Data/Applications/Acculog/DataManagement");
  const [headers, setHeaders] = useState<Record<string, string>>({
    "Content-Type": "application/json",
    "Authorization": `Bearer ${DEFAULT_API_TOKEN}`
  });
  const [body, setBody] = useState(JSON.stringify({
    action: "stats"
  }, null, 2));
  
  // Response State
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("body");
  const [useProxy, setUseProxy] = useState(false);
  
  // History State
  const [history, setHistory] = useState<ApiRequest[]>([]);
  const [savedRequests, setSavedRequests] = useState<SavedRequest[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [requestName, setRequestName] = useState("");
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);

  // Load history and saved requests from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("apiTester_savedRequests");
    if (saved) {
      setSavedRequests(JSON.parse(saved));
    }
    const hist = localStorage.getItem("apiTester_history");
    if (hist) {
      setHistory(JSON.parse(hist));
    }
  }, []);

  // Save to localStorage
  const saveToStorage = (requests: SavedRequest[]) => {
    localStorage.setItem("apiTester_savedRequests", JSON.stringify(requests));
    setSavedRequests(requests);
  };

  const saveHistory = (hist: ApiRequest[]) => {
    localStorage.setItem("apiTester_history", JSON.stringify(hist.slice(0, 50)));
    setHistory(hist);
  };

  // Send API Request
  const sendRequest = async () => {
    setIsLoading(true);
    setResponse(null);
    const startTime = performance.now();
    
    try {
      let res;
      
      if (useProxy) {
        // Use proxy to bypass CORS
        const proxyRes = await fetch("/api/proxy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetUrl: url,
            method,
            headers,
            payload: method !== "GET" && method !== "HEAD" ? JSON.parse(body || "{}") : undefined
          })
        });
        
        const proxyData = await proxyRes.json();
        
        if (!proxyData.success) {
          throw new Error(proxyData.message || "Proxy request failed");
        }
        
        // Create a mock Response object for consistent handling
        res = {
          status: proxyData.status,
          statusText: proxyData.statusText,
          headers: new Headers(proxyData.headers),
          json: async () => proxyData.data,
          text: async () => typeof proxyData.data === "string" ? proxyData.data : JSON.stringify(proxyData.data)
        } as Response;
      } else {
        // Direct request (may have CORS issues)
        const options: RequestInit = {
          method,
          headers: headers
        };
        
        if (method !== "GET" && method !== "HEAD" && body) {
          options.body = body;
        }
        
        res = await fetch(url, options);
      }
      
      const endTime = performance.now();
      
      // Get response headers
      const responseHeaders: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
      
      // Get response body
      let responseBody;
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        responseBody = await res.json();
      } else {
        responseBody = await res.text();
      }
      
      // Calculate size
      const responseSize = JSON.stringify(responseBody).length;
      const sizeFormatted = responseSize > 1024 
        ? `${(responseSize / 1024).toFixed(2)} KB` 
        : `${responseSize} B`;
      
      const apiResponse: ApiResponse = {
        status: res.status,
        statusText: res.statusText,
        headers: responseHeaders,
        body: responseBody,
        time: Math.round(endTime - startTime),
        size: sizeFormatted
      };
      
      setResponse(apiResponse);
      setActiveTab("body");
      
      // Add to history
      const newRequest: ApiRequest = {
        id: Date.now().toString(),
        name: `${method} ${url}`,
        method,
        url,
        headers,
        body,
        timestamp: new Date().toLocaleString()
      };
      saveHistory([newRequest, ...history]);
      
      toast.success(`Request completed in ${apiResponse.time}ms`);
    } catch (error: any) {
      toast.error("Request failed: " + error.message);
      setResponse({
        status: 0,
        statusText: "Error",
        headers: {},
        body: { error: error.message },
        time: 0,
        size: "0 B"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Save Request
  const saveCurrentRequest = () => {
    if (!requestName.trim()) {
      toast.error("Please enter a request name");
      return;
    }
    
    const newSaved: SavedRequest = {
      id: Date.now().toString(),
      name: requestName,
      method,
      url,
      headers,
      body,
      createdAt: new Date().toLocaleString()
    };
    
    saveToStorage([newSaved, ...savedRequests]);
    setShowSaveDialog(false);
    setRequestName("");
    toast.success("Request saved!");
  };

  // Load saved request
  const loadSavedRequest = (req: SavedRequest) => {
    setMethod(req.method);
    setUrl(req.url);
    setHeaders(req.headers);
    setBody(req.body);
    toast.success(`Loaded: ${req.name}`);
  };

  // Load history request
  const loadHistoryRequest = (req: ApiRequest) => {
    setMethod(req.method);
    setUrl(req.url);
    setHeaders(req.headers);
    setBody(req.body);
    setSelectedHistoryId(req.id);
  };

  // Delete saved request
  const deleteSavedRequest = (id: string) => {
    const filtered = savedRequests.filter(r => r.id !== id);
    saveToStorage(filtered);
    toast.success("Request deleted");
  };

  // Add header
  const addHeader = () => {
    setHeaders({ ...headers, "": "" });
  };

  // Update header
  const updateHeader = (oldKey: string, newKey: string, value: string) => {
    const newHeaders = { ...headers };
    delete newHeaders[oldKey];
    if (newKey) {
      newHeaders[newKey] = value;
    }
    setHeaders(newHeaders);
  };

  // Remove header
  const removeHeader = (key: string) => {
    const newHeaders = { ...headers };
    delete newHeaders[key];
    setHeaders(newHeaders);
  };

  // Format JSON
  const formatJson = () => {
    try {
      const parsed = JSON.parse(body);
      setBody(JSON.stringify(parsed, null, 2));
      toast.success("JSON formatted");
    } catch {
      toast.error("Invalid JSON");
    }
  };

  // Copy response
  const copyResponse = () => {
    navigator.clipboard.writeText(JSON.stringify(response?.body, null, 2));
    toast.success("Response copied to clipboard");
  };

  // Get status color
  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/50";
    if (status >= 300 && status < 400) return "bg-amber-500/20 text-amber-400 border-amber-500/50";
    if (status >= 400) return "bg-red-500/20 text-red-400 border-red-500/50";
    return "bg-slate-500/20 text-slate-400 border-slate-500/50";
  };

  return (
    <TooltipProvider delayDuration={0}>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          {/* Dark Tech Background */}
          <div className="min-h-screen w-full bg-[#050a14] relative overflow-hidden">
            {/* Animated background grid */}
            <div className="absolute inset-0 h-full w-full">
              <div 
                className="absolute inset-0 opacity-[0.03]"
                style={{
                  backgroundImage: `
                    linear-gradient(rgba(6,182,212,0.5) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(6,182,212,0.5) 1px, transparent 1px)
                  `,
                  backgroundSize: '50px 50px',
                }}
              />
            </div>

            {/* Main Content */}
            <div className="relative z-10 w-full">
              {/* Header */}
              <header className="flex h-16 items-center gap-2 px-4 border-b border-cyan-500/20 bg-slate-900/50 backdrop-blur-sm">
                <SidebarTrigger className="-ml-1 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/20" />
                <Separator orientation="vertical" className="h-4 bg-cyan-500/30" />
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbLink href="/dashboard" className="text-cyan-400 hover:text-cyan-300">Dashboard</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="text-cyan-500/50" />
                    <BreadcrumbItem>
                      <BreadcrumbLink href="/settings/general" className="text-cyan-400 hover:text-cyan-300">Settings</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="text-cyan-500/50" />
                    <BreadcrumbItem>
                      <BreadcrumbPage className="text-cyan-100">API Tester</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </header>

              {/* Page Title */}
              <div className="px-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
                    <Terminal className="h-6 w-6 text-cyan-400" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-white tracking-wider">API TESTER</h1>
                    <p className="text-sm text-cyan-300/60">Test and debug API endpoints with your token</p>
                  </div>
                </div>
              </div>

              {/* Main Content */}
              <div className="px-4 pb-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Left Panel - Request */}
                  <div className="lg:col-span-2 space-y-4">
                    {/* Request Card */}
                    <Card className="relative group bg-slate-900/90 border-cyan-500/30">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg blur opacity-10 group-hover:opacity-20 transition-opacity" />
                      <CardHeader className="relative">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Send className="h-5 w-5 text-cyan-400" />
                            <CardTitle className="text-white tracking-wider">REQUEST</CardTitle>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setShowSaveDialog(true)}
                              className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20"
                            >
                              <Save className="h-4 w-4 mr-2" />
                              Save
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={formatJson}
                              className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20"
                            >
                              <Code className="h-4 w-4 mr-2" />
                              Format JSON
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="relative space-y-4">
                        {/* URL Row */}
                        <div className="flex gap-2">
                          <Select value={method} onValueChange={setMethod}>
                            <SelectTrigger className="w-28 bg-slate-900/50 border-cyan-500/30 text-cyan-100">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-cyan-500/30">
                              {["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].map(m => (
                                <SelectItem key={m} value={m} className="text-cyan-100">{m}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="Enter API URL..."
                            className="flex-1 bg-slate-900/50 border-cyan-500/30 text-cyan-100 placeholder:text-cyan-300/40"
                          />
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setUseProxy(!useProxy)}
                                className={`border-cyan-500/30 ${useProxy ? 'bg-cyan-500/20 text-cyan-300' : 'text-cyan-400'} hover:bg-cyan-500/20`}
                              >
                                {useProxy ? <Globe className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{useProxy ? 'Using Proxy (CORS bypass)' : 'Direct Request (CORS restrictions apply)'}</p>
                            </TooltipContent>
                          </Tooltip>
                          <Button
                            onClick={sendRequest}
                            disabled={isLoading}
                            className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white border-0"
                          >
                            {isLoading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                            Send
                          </Button>
                        </div>
                        {useProxy && (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                            <Globe className="h-4 w-4 text-cyan-400" />
                            <span className="text-sm text-cyan-300">Proxy Mode: CORS bypass enabled. Requests go through your server.</span>
                          </div>
                        )}

                        {/* Tabs for Body/Headers */}
                        <Tabs defaultValue="body" className="w-full">
                          <TabsList className="bg-slate-900/50 border border-cyan-500/30">
                            <TabsTrigger value="body" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300 text-cyan-400">
                              <FileJson className="h-4 w-4 mr-2" />
                              Body
                            </TabsTrigger>
                            <TabsTrigger value="headers" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300 text-cyan-400">
                              <LayoutGrid className="h-4 w-4 mr-2" />
                              Headers ({Object.keys(headers).length})
                            </TabsTrigger>
                          </TabsList>

                          <TabsContent value="body" className="mt-2">
                            <Textarea
                              value={body}
                              onChange={(e) => setBody(e.target.value)}
                              placeholder="Request body (JSON)..."
                              className="min-h-[200px] bg-slate-900/50 border-cyan-500/30 text-cyan-100 placeholder:text-cyan-300/40 font-mono text-sm"
                            />
                          </TabsContent>

                          <TabsContent value="headers" className="mt-2 space-y-2">
                            {Object.entries(headers).map(([key, value], index) => (
                              <div key={index} className="flex gap-2">
                                <Input
                                  value={key}
                                  onChange={(e) => updateHeader(key, e.target.value, value)}
                                  placeholder="Header name"
                                  className="flex-1 bg-slate-900/50 border-cyan-500/30 text-cyan-100 placeholder:text-cyan-300/40"
                                />
                                <Input
                                  value={value}
                                  onChange={(e) => updateHeader(key, key, e.target.value)}
                                  placeholder="Header value"
                                  className="flex-1 bg-slate-900/50 border-cyan-500/30 text-cyan-100 placeholder:text-cyan-300/40"
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeHeader(key)}
                                  className="text-red-400 hover:text-red-300 hover:bg-red-500/20"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={addHeader}
                              className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20"
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Add Header
                            </Button>
                          </TabsContent>
                        </Tabs>
                      </CardContent>
                    </Card>

                    {/* Response Card */}
                    <Card className="relative group bg-slate-900/90 border-cyan-500/30">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg blur opacity-10 group-hover:opacity-20 transition-opacity" />
                      <CardHeader className="relative">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Database className="h-5 w-5 text-cyan-400" />
                            <CardTitle className="text-white tracking-wider">RESPONSE</CardTitle>
                          </div>
                          {response && (
                            <div className="flex items-center gap-2">
                              <Badge className={getStatusColor(response.status)}>
                                {response.status} {response.statusText}
                              </Badge>
                              <Badge variant="outline" className="border-cyan-500/30 text-cyan-400">
                                <Clock className="h-3 w-3 mr-1" />
                                {response.time}ms
                              </Badge>
                              <Badge variant="outline" className="border-cyan-500/30 text-cyan-400">
                                {response.size}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={copyResponse}
                                className="text-cyan-400 hover:text-cyan-300"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="relative">
                        {!response ? (
                          <div className="flex flex-col items-center justify-center py-12 text-cyan-300/40">
                            <Terminal className="h-12 w-12 mb-4 opacity-50" />
                            <p>Send a request to see the response</p>
                          </div>
                        ) : (
                          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="bg-slate-900/50 border border-cyan-500/30">
                              <TabsTrigger value="body" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300 text-cyan-400">
                                Body
                              </TabsTrigger>
                              <TabsTrigger value="headers" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300 text-cyan-400">
                                Headers
                              </TabsTrigger>
                              <TabsTrigger value="table" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300 text-cyan-400">
                                Table
                              </TabsTrigger>
                            </TabsList>

                            <TabsContent value="body" className="mt-2">
                              <pre className="bg-slate-950/50 border border-cyan-500/20 rounded-lg p-4 overflow-auto max-h-[400px] text-sm font-mono text-cyan-100">
                                {JSON.stringify(response.body, null, 2)}
                              </pre>
                            </TabsContent>

                            <TabsContent value="headers" className="mt-2">
                              <Table>
                                <TableHeader>
                                  <TableRow className="border-b border-cyan-500/20">
                                    <TableHead className="text-cyan-300">Header</TableHead>
                                    <TableHead className="text-cyan-300">Value</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {Object.entries(response.headers).map(([key, value]) => (
                                    <TableRow key={key} className="border-b border-cyan-500/10">
                                      <TableCell className="text-cyan-100 font-medium">{key}</TableCell>
                                      <TableCell className="text-cyan-300/70">{value}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TabsContent>

                            <TabsContent value="table" className="mt-2">
                              {Array.isArray(response.body) ? (
                                <div className="overflow-auto max-h-[400px]">
                                  <Table>
                                    <TableHeader>
                                      <TableRow className="border-b border-cyan-500/20">
                                        {Object.keys(response.body[0] || {}).map(key => (
                                          <TableHead key={key} className="text-cyan-300">{key}</TableHead>
                                        ))}
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {response.body.map((row: any, idx: number) => (
                                        <TableRow key={idx} className="border-b border-cyan-500/10">
                                          {Object.values(row).map((val: any, i) => (
                                            <TableCell key={i} className="text-cyan-300/70">
                                              {typeof val === "object" ? JSON.stringify(val) : String(val)}
                                            </TableCell>
                                          ))}
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              ) : response.body?.data && Array.isArray(response.body.data) ? (
                                <div className="overflow-auto max-h-[400px]">
                                  <Table>
                                    <TableHeader>
                                      <TableRow className="border-b border-cyan-500/20">
                                        {Object.keys(response.body.data[0] || {}).map(key => (
                                          <TableHead key={key} className="text-cyan-300">{key}</TableHead>
                                        ))}
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {response.body.data.map((row: any, idx: number) => (
                                        <TableRow key={idx} className="border-b border-cyan-500/10">
                                          {Object.values(row).map((val: any, i) => (
                                            <TableCell key={i} className="text-cyan-300/70">
                                              {typeof val === "object" ? JSON.stringify(val) : String(val)}
                                            </TableCell>
                                          ))}
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              ) : (
                                <div className="text-center py-8 text-cyan-300/60">
                                  <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                                  <p>Response is not an array. Switch to Body tab to view.</p>
                                </div>
                              )}
                            </TabsContent>
                          </Tabs>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Right Panel - History & Saved */}
                  <div className="space-y-4">
                    {/* Saved Requests */}
                    <Card className="relative group bg-slate-900/90 border-cyan-500/30">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg blur opacity-10 group-hover:opacity-20 transition-opacity" />
                      <CardHeader className="relative">
                        <div className="flex items-center gap-2">
                          <Save className="h-5 w-5 text-cyan-400" />
                          <CardTitle className="text-white tracking-wider text-sm">SAVED REQUESTS</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="relative">
                        <div className="space-y-2 max-h-[200px] overflow-auto">
                          {savedRequests.length === 0 ? (
                            <p className="text-cyan-300/40 text-sm text-center py-4">No saved requests</p>
                          ) : (
                            savedRequests.map((req) => (
                              <div
                                key={req.id}
                                className="flex items-center justify-between p-2 rounded-lg bg-slate-800/50 border border-cyan-500/20 hover:border-cyan-500/40 cursor-pointer group"
                                onClick={() => loadSavedRequest(req)}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <Badge className={
                                    req.method === "GET" ? "bg-blue-500/20 text-blue-400" :
                                    req.method === "POST" ? "bg-emerald-500/20 text-emerald-400" :
                                    req.method === "PUT" ? "bg-amber-500/20 text-amber-400" :
                                    "bg-red-500/20 text-red-400"
                                  }>
                                    {req.method}
                                  </Badge>
                                  <span className="text-cyan-100 text-sm truncate">{req.name}</span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteSavedRequest(req.id);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 hover:bg-red-500/20 h-6 w-6"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            ))
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* History */}
                    <Card className="relative group bg-slate-900/90 border-cyan-500/30">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg blur opacity-10 group-hover:opacity-20 transition-opacity" />
                      <CardHeader className="relative">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <History className="h-5 w-5 text-cyan-400" />
                            <CardTitle className="text-white tracking-wider text-sm">HISTORY</CardTitle>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              localStorage.removeItem("apiTester_history");
                              setHistory([]);
                              toast.success("History cleared");
                            }}
                            className="text-cyan-400 hover:text-cyan-300"
                          >
                            Clear
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="relative">
                        <div className="space-y-2 max-h-[300px] overflow-auto">
                          {history.length === 0 ? (
                            <p className="text-cyan-300/40 text-sm text-center py-4">No history yet</p>
                          ) : (
                            history.map((req) => (
                              <div
                                key={req.id}
                                className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                                  selectedHistoryId === req.id
                                    ? "bg-cyan-500/20 border-cyan-500/50"
                                    : "bg-slate-800/50 border-cyan-500/20 hover:border-cyan-500/40"
                                }`}
                                onClick={() => loadHistoryRequest(req)}
                              >
                                <Badge className={
                                  req.method === "GET" ? "bg-blue-500/20 text-blue-400" :
                                  req.method === "POST" ? "bg-emerald-500/20 text-emerald-400" :
                                  req.method === "PUT" ? "bg-amber-500/20 text-amber-400" :
                                  "bg-red-500/20 text-red-400"
                                }>
                                  {req.method}
                                </Badge>
                                <div className="flex-1 min-w-0">
                                  <p className="text-cyan-100 text-sm truncate">{req.url}</p>
                                  <p className="text-cyan-300/40 text-xs">{req.timestamp}</p>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Quick Tips */}
                    <Card className="relative group bg-slate-900/90 border-cyan-500/30">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg blur opacity-10 group-hover:opacity-20 transition-opacity" />
                      <CardHeader className="relative">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-5 w-5 text-cyan-400" />
                          <CardTitle className="text-white tracking-wider text-sm">QUICK TIPS</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="relative">
                        <ul className="text-sm text-cyan-300/60 space-y-2">
                          <li className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                            <span>Token is automatically included in headers</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                            <span>Use Format JSON to prettify request body</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                            <span>Table view works best for array responses</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                            <span>Saved requests are stored locally</span>
                          </li>
                        </ul>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Save Request Dialog */}
          <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
            <DialogContent className="bg-[#0a0f1c] border border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.15)]">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-white tracking-wider flex items-center gap-2">
                  <Save className="h-5 w-5 text-cyan-400" />
                  SAVE REQUEST
                </DialogTitle>
                <DialogDescription className="text-cyan-300/60">
                  Give your request a name to save it for later
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Input
                  value={requestName}
                  onChange={(e) => setRequestName(e.target.value)}
                  placeholder="e.g., Get Data Management Stats"
                  className="bg-slate-900/50 border-cyan-500/30 text-cyan-100 placeholder:text-cyan-300/40"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveCurrentRequest();
                  }}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => setShowSaveDialog(false)}
                  variant="outline"
                  className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20"
                >
                  Cancel
                </Button>
                <Button
                  onClick={saveCurrentRequest}
                  className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
