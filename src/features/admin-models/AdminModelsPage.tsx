"use client";

import { useState, useEffect } from "react";
import { Button } from "@/features/ui/button";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/features/ui/table";
import { Badge } from "@/features/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/features/ui/card";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from "@/features/ui/dialog";
import { Input } from "@/features/ui/input";
import { Label } from "@/features/ui/label";
import { Switch } from "@/features/ui/switch";
import { Textarea } from "@/features/ui/textarea";
import { useToast } from "@/features/ui/use-toast";
import { 
  Plus, 
  Edit, 
  Trash2, 
  Star, 
  Loader2, 
  Eye, 
  EyeOff,
  Shield,
  RefreshCw
} from "lucide-react";
import { AdminModelView, ModelConfigInput } from "@/types/models";

interface ModelFormData {
  id?: string;
  friendlyName: string;
  instanceName: string;
  deploymentName: string;
  apiVersion: string;
  apiKeyPlaintext?: string;
  enabled: boolean;
  isDefault: boolean;
  sortOrder: number;
}

const defaultFormData: ModelFormData = {
  friendlyName: "",
  instanceName: "",
  deploymentName: "",
  apiVersion: "2024-10-21",
  enabled: true,
  isDefault: false,
  sortOrder: 100
};

export default function AdminModelsPage() {
  const [models, setModels] = useState<AdminModelView[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<ModelFormData>(defaultFormData);
  const [showApiKey, setShowApiKey] = useState(false);
  const [deleteModel, setDeleteModel] = useState<AdminModelView | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/models');
      
      if (!response.ok) {
        throw new Error(`Failed to load models: ${response.status}`);
      }
      
      const data = await response.json();
      setModels(data);
    } catch (error) {
      console.error('Failed to load models:', error);
      toast({
        title: "Error",
        description: "Failed to load models. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setFormData(defaultFormData);
    setShowForm(true);
    setShowApiKey(false);
  };

  const handleEdit = (model: AdminModelView) => {
    setFormData({
      id: model.id,
      friendlyName: model.friendlyName,
      instanceName: model.instanceName,
      deploymentName: model.deploymentName,
      apiVersion: model.apiVersion,
      enabled: model.enabled,
      isDefault: model.isDefault,
      sortOrder: model.sortOrder || 100
    });
    setShowForm(true);
    setShowApiKey(false);
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Validation
      if (!formData.friendlyName.trim()) {
        toast({
          title: "Validation Error",
          description: "Friendly name is required.",
          variant: "destructive"
        });
        return;
      }

      if (!formData.instanceName.trim()) {
        toast({
          title: "Validation Error", 
          description: "Instance name is required.",
          variant: "destructive"
        });
        return;
      }

      if (!formData.deploymentName.trim()) {
        toast({
          title: "Validation Error",
          description: "Deployment name is required.",
          variant: "destructive"
        });
        return;
      }

      if (!formData.id && !formData.apiKeyPlaintext?.trim()) {
        toast({
          title: "Validation Error",
          description: "API key is required for new models.",
          variant: "destructive"
        });
        return;
      }

      const payload: ModelConfigInput = {
        id: formData.id,
        friendlyName: formData.friendlyName.trim(),
        instanceName: formData.instanceName.trim(),
        deploymentName: formData.deploymentName.trim(),
        apiVersion: formData.apiVersion.trim(),
        enabled: formData.enabled,
        isDefault: formData.isDefault,
        sortOrder: formData.sortOrder
      };

      if (formData.apiKeyPlaintext?.trim()) {
        payload.apiKeyPlaintext = formData.apiKeyPlaintext.trim();
      }

      const url = formData.id ? `/api/admin/models/${formData.id}` : '/api/admin/models';
      const method = formData.id ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save model');
      }

      toast({
        title: "Success",
        description: `Model ${formData.id ? 'updated' : 'created'} successfully.`
      });

      setShowForm(false);
      loadModels();
    } catch (error) {
      console.error('Failed to save model:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save model.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (model: AdminModelView) => {
    try {
      const response = await fetch(`/api/admin/models/${model.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete model');
      }

      toast({
        title: "Success",
        description: "Model deleted successfully."
      });

      setDeleteModel(null);
      loadModels();
    } catch (error) {
      console.error('Failed to delete model:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete model.",
        variant: "destructive"
      });
    }
  };

  const handleSetDefault = async (modelId: string) => {
    try {
      const response = await fetch(`/api/admin/models/${modelId}/default`, {
        method: 'POST'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to set default model');
      }

      toast({
        title: "Success",
        description: "Default model updated successfully."
      });

      loadModels();
    } catch (error) {
      console.error('Failed to set default model:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to set default model.",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading models...</span>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Model Management
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage Azure OpenAI model configurations for the application
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadModels}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Model
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Models ({models.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {models.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">No models configured yet.</p>
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Model
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Instance</TableHead>
                  <TableHead>Deployment</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Default</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {models.map((model) => (
                  <TableRow key={model.id}>
                    <TableCell className="font-medium">{model.friendlyName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">Azure OpenAI</Badge>
                    </TableCell>
                    <TableCell>{model.instanceName}</TableCell>
                    <TableCell>{model.deploymentName}</TableCell>
                    <TableCell>{model.apiVersion}</TableCell>
                    <TableCell>
                      {model.enabled ? (
                        <Badge variant="default">Enabled</Badge>
                      ) : (
                        <Badge variant="secondary">Disabled</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {model.isDefault ? (
                        <Badge variant="default">
                          <Star className="h-3 w-3 mr-1" />
                          Default
                        </Badge>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSetDefault(model.id)}
                          disabled={!model.enabled}
                        >
                          Set Default
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(model.updatedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(model)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={model.isDefault && models.filter(m => m.enabled).length <= 1}
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to delete "${model.friendlyName}"? This action cannot be undone.`)) {
                              handleDelete(model);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Model Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {formData.id ? "Edit Model" : "Add New Model"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="friendlyName">Friendly Name</Label>
                <Input
                  id="friendlyName"
                  value={formData.friendlyName}
                  onChange={(e) => setFormData({ ...formData, friendlyName: e.target.value })}
                  placeholder="GPT-4o Mini"
                />
              </div>
              <div>
                <Label htmlFor="instanceName">Instance Name</Label>
                <Input
                  id="instanceName"
                  value={formData.instanceName}
                  onChange={(e) => setFormData({ ...formData, instanceName: e.target.value })}
                  placeholder="my-openai-instance"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="deploymentName">Deployment Name</Label>
                <Input
                  id="deploymentName"
                  value={formData.deploymentName}
                  onChange={(e) => setFormData({ ...formData, deploymentName: e.target.value })}
                  placeholder="gpt-4o-mini"
                />
              </div>
              <div>
                <Label htmlFor="apiVersion">API Version</Label>
                <Input
                  id="apiVersion"
                  value={formData.apiVersion}
                  onChange={(e) => setFormData({ ...formData, apiVersion: e.target.value })}
                  placeholder="2024-10-21"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="apiKey">API Key</Label>
              <div className="flex gap-2">
                <Input
                  id="apiKey"
                  type={showApiKey ? "text" : "password"}
                  value={formData.apiKeyPlaintext || ""}
                  onChange={(e) => setFormData({ ...formData, apiKeyPlaintext: e.target.value })}
                  placeholder={formData.id ? "Leave blank to keep existing key" : "Required for new models"}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="sortOrder">Sort Order</Label>
                <Input
                  id="sortOrder"
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 100 })}
                  min="0"
                  max="999"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="enabled"
                  checked={formData.enabled}
                  onCheckedChange={(enabled) => setFormData({ ...formData, enabled })}
                />
                <Label htmlFor="enabled">Enabled</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="isDefault"
                  checked={formData.isDefault}
                  onCheckedChange={(isDefault) => setFormData({ ...formData, isDefault })}
                />
                <Label htmlFor="isDefault">Default</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>Save</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
