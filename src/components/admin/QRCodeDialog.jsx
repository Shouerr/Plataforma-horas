import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { QrCode, Download, Copy } from "lucide-react";
import toast from "react-hot-toast";

export function QRCodeDialog({ eventId, eventTitle, children }) {
  // 🔗 Base URL fija para pruebas en red local (PC: 192.168.3.8, puerto 5173)
  const baseUrl = "http://192.168.3.8:5173";

  // El link que se abrirá al escanear el código
  const eventUrl = `${baseUrl}/scanner?eventId=${encodeURIComponent(
    eventId
  )}`;

  // El QR se genera a partir de ese enlace
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
    eventUrl
  )}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(eventUrl);
      toast.success("Enlace copiado al portapapeles");
    } catch {
      toast.error("No se pudo copiar el enlace");
    }
  };

  const handleDownloadQR = () => {
    const link = document.createElement("a");
    link.href = qrCodeUrl;
    link.download = `qr_evento_${eventId}.png`;
    link.click();
    toast("Descargando QR…");
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <QrCode className="w-5 h-5 mr-2" />
            Código QR del Evento
          </DialogTitle>
          <DialogDescription>
            Al escanear este código, se abrirá la página para registrar la
            asistencia al evento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card className="p-0">
            <CardContent className="p-6">
              <div className="text-center space-y-4">
                <h3 className="font-semibold text-lg">{eventTitle}</h3>

                <div className="flex justify-center">
                  <div className="p-4 bg-white rounded-lg shadow-elevation-medium">
                    <img
                      src={qrCodeUrl}
                      alt="Código QR del evento"
                      className="w-48 h-48"
                    />
                  </div>
                </div>

                <div className="text-sm text-muted-foreground space-y-1">
                  <p className="font-medium">ID del Evento:</p>
                  <p className="font-mono text-xs bg-muted p-2 rounded break-all">
                    {eventId}
                  </p>

                  <p className="font-medium mt-2">Enlace del evento:</p>
                  <p className="font-mono text-xs bg-muted p-2 rounded break-all">
                    {eventUrl}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleCopyLink}
              className="flex-1"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copiar Enlace
            </Button>
            <Button
              variant="outline"
              onClick={handleDownloadQR}
              className="flex-1"
            >
              <Download className="w-4 h-4 mr-2" />
              Descargar QR
            </Button>
          </div>

          <div className="text-xs text-muted-foreground text-center p-3 bg-muted/30 rounded-lg">
            <p>
              <strong>Instrucciones:</strong>
            </p>
            <p>
              Los estudiantes pueden escanear este código con la cámara del
              celular. Se abrirá la página para registrar su asistencia al
              evento (entrada o salida).
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
