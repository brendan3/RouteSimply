import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Camera, Check, X, SkipForward, Loader2 } from "lucide-react";
import type { RouteStop } from "@shared/schema";

interface StopCompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stop: RouteStop | null;
  onComplete: (data: { status: "completed" | "skipped"; notes?: string; photoFile?: File }) => void;
  isLoading?: boolean;
}

export function StopCompletionDialog({
  open,
  onOpenChange,
  stop,
  onComplete,
  isLoading,
}: StopCompletionDialogProps) {
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (status: "completed" | "skipped") => {
    onComplete({
      status,
      notes: notes || undefined,
      photoFile: photo || undefined,
    });
    // Reset form
    setNotes("");
    setPhoto(null);
    setPhotoPreview(null);
  };

  const handleClose = () => {
    setNotes("");
    setPhoto(null);
    setPhotoPreview(null);
    onOpenChange(false);
  };

  if (!stop) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">Complete Stop</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Stop info */}
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="font-medium text-sm">{stop.customerName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stop.address}</p>
            {stop.serviceType && (
              <p className="text-xs text-muted-foreground/70 mt-0.5">{stop.serviceType}</p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm font-medium">
              Notes (optional)
            </Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about this stop..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Photo proof */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Photo Proof (optional)</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoSelect}
              className="hidden"
            />
            {photoPreview ? (
              <div className="relative">
                <img
                  src={photoPreview}
                  alt="Photo proof"
                  className="w-full h-32 object-cover rounded-lg"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-1 right-1 h-6 w-6"
                  onClick={() => {
                    setPhoto(null);
                    setPhotoPreview(null);
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full h-20 flex flex-col gap-1"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="h-5 w-5" />
                <span className="text-xs">Take Photo</span>
              </Button>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={() => handleSubmit("skipped")}
              disabled={isLoading}
            >
              <SkipForward className="h-4 w-4" />
              Skip
            </Button>
            <Button
              className="flex-1 gap-2"
              onClick={() => handleSubmit("completed")}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Complete
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
