import React, { useEffect, useState, useRef, useCallback } from 'react';
import axios from 'axios';
import Webcam from 'react-webcam';
import { Sidebar } from '../components/Sidebar';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Camera, DoorOpen, X, Check } from '@phosphor-icons/react';
import { toast } from 'sonner';

export default function CheckIn() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [idData, setIdData] = useState(null);
  const webcamRef = useRef(null);

  const fetchBookings = useCallback(async () => {
    try {
      const { data } = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/api/bookings`,
        { withCredentials: true }
      );
      setBookings(data.filter(b => b.status === 'pending'));
    } catch (error) {
      toast.error('Fehler beim Laden der Buchungen');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const capturePhoto = () => {
    const imageSrc = webcamRef.current.getScreenshot();
    setCapturedImage(imageSrc);
  };

  const scanID = async () => {
    if (!capturedImage) {
      toast.error('Bitte nehmen Sie zuerst ein Foto auf');
      return;
    }

    setScanning(true);
    try {
      const base64Data = capturedImage.split(',')[1];
      const blob = await fetch(capturedImage).then(r => r.blob());
      const file = new File([blob], 'id-scan.jpg', { type: 'image/jpeg' });

      const formData = new FormData();
      formData.append('file', file);

      const { data } = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/scan-id`,
        formData,
        { 
          withCredentials: true,
          headers: { 'Content-Type': 'multipart/form-data' }
        }
      );

      setIdData(data);
      toast.success('ID erfolgreich gescannt!');
    } catch (error) {
      toast.error('Fehler beim Scannen des Ausweises');
      console.error(error);
    } finally {
      setScanning(false);
    }
  };

  const handleCheckIn = async () => {
    try {
      await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/bookings/${selectedBooking._id}/check-in`,
        {
          id_verified: !!idData,
          id_data: idData ? { raw_text: idData.raw_text } : null
        },
        { withCredentials: true }
      );
      toast.success('Check-In erfolgreich!');
      setShowScanner(false);
      setSelectedBooking(null);
      setCapturedImage(null);
      setIdData(null);
      fetchBookings();
    } catch (error) {
      toast.error('Fehler beim Check-In');
    }
  };

  const handleCheckOut = async (bookingId) => {
    try {
      await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/bookings/${bookingId}/check-out`,
        {},
        { withCredentials: true }
      );
      toast.success('Check-Out erfolgreich!');
      fetchBookings();
    } catch (error) {
      toast.error('Fehler beim Check-Out');
    }
  };

  const openScanner = (booking) => {
    setSelectedBooking(booking);
    setShowScanner(true);
    setCapturedImage(null);
    setIdData(null);
  };

  const getStatusBadge = (verified) => {
    if (verified) {
      return <Badge className="text-emerald-700 bg-emerald-50 border-emerald-200">Verifiziert</Badge>;
    }
    return <Badge className="text-gold-700 bg-gold-50 border-gold-200">Noch nicht verifiziert</Badge>;
  };

  return (
    <div className="flex" data-testid="checkin-page">
      <Sidebar />
      <div className="flex-1 ml-64">
        <div className="bg-white/80 backdrop-blur-xl border-b border-zinc-200 sticky top-0 z-40">
          <div className="p-6">
            <h1 className="text-4xl font-bold tracking-tight text-zinc-950 font-heading">Check-In / Check-Out</h1>
            <p className="text-zinc-600 mt-1">Gäste einchecken mit ID-Verifizierung</p>
          </div>
        </div>

        <div className="p-8">
          <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-zinc-50 border-b border-zinc-200">
                  <TableHead className="font-semibold text-zinc-950">Gastname</TableHead>
                  <TableHead className="font-semibold text-zinc-950">Zimmer</TableHead>
                  <TableHead className="font-semibold text-zinc-950">Check-In</TableHead>
                  <TableHead className="font-semibold text-zinc-950">Check-Out</TableHead>
                  <TableHead className="font-semibold text-zinc-950">Gäste</TableHead>
                  <TableHead className="font-semibold text-zinc-950">Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
                    </TableCell>
                  </TableRow>
                ) : bookings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-zinc-600">
                      Keine ausstehenden Check-Ins
                    </TableCell>
                  </TableRow>
                ) : (
                  bookings.map((booking) => (
                    <TableRow key={booking._id} data-testid={`checkin-row-${booking._id}`}>
                      <TableCell className="font-medium">{booking.guest_name}</TableCell>
                      <TableCell>{booking.room_number}</TableCell>
                      <TableCell>{booking.check_in_date}</TableCell>
                      <TableCell>{booking.check_out_date}</TableCell>
                      <TableCell>{booking.guests_count}</TableCell>
                      <TableCell>
                        <Button
                          onClick={() => openScanner(booking)}
                          data-testid={`checkin-button-${booking._id}`}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <DoorOpen size={18} className="mr-2" weight="fill" />
                          Check-In
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <Dialog open={showScanner} onOpenChange={(open) => {
        setShowScanner(open);
        if (!open) {
          setSelectedBooking(null);
          setCapturedImage(null);
          setIdData(null);
        }
      }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-heading">
              Check-In: {selectedBooking?.guest_name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold tracking-[0.1em] uppercase text-zinc-500 mb-2">
                  Buchungsdetails
                </p>
                <div className="space-y-2 text-sm">
                  <p><span className="font-semibold">Zimmer:</span> {selectedBooking?.room_number}</p>
                  <p><span className="font-semibold">Typ:</span> {selectedBooking?.room_type}</p>
                  <p><span className="font-semibold">Gäste:</span> {selectedBooking?.guests_count}</p>
                  <p><span className="font-semibold">Check-Out:</span> {selectedBooking?.check_out_date}</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold tracking-[0.1em] uppercase text-zinc-500 mb-2">
                  ID-Verifizierung
                </p>
                {idData ? (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Check size={20} weight="bold" className="text-emerald-600" />
                      <span className="font-semibold text-emerald-700">ID Verifiziert</span>
                    </div>
                    <p className="text-sm text-zinc-600 whitespace-pre-wrap">
                      {idData.raw_text}
                    </p>
                  </div>
                ) : (
                  getStatusBadge(false)
                )}
              </div>
            </div>

            <div className="border-t pt-6">
              <p className="text-xs font-semibold tracking-[0.1em] uppercase text-zinc-500 mb-4">
                Ausweis / Reisepass scannen
              </p>

              {!capturedImage ? (
                <div className="relative">
                  <Webcam
                    ref={webcamRef}
                    audio={false}
                    screenshotFormat="image/jpeg"
                    className="w-full rounded-lg border border-zinc-200"
                    data-testid="webcam"
                  />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="border-4 border-white/50 rounded-lg w-2/3 h-2/3"></div>
                  </div>
                  <div className="mt-4">
                    <Button
                      onClick={capturePhoto}
                      data-testid="capture-photo-button"
                      className="w-full bg-zinc-900 hover:bg-zinc-950 text-white"
                    >
                      <Camera size={20} weight="fill" className="mr-2" />
                      Foto aufnehmen
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="relative">
                    <img src={capturedImage} alt="Captured ID" className="w-full rounded-lg border border-zinc-200" />
                    <button
                      onClick={() => setCapturedImage(null)}
                      className="absolute top-2 right-2 p-2 bg-white rounded-full shadow-lg hover:bg-zinc-100 transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  <div className="mt-4 flex gap-3">
                    <Button
                      onClick={scanID}
                      disabled={scanning}
                      data-testid="scan-id-button"
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {scanning ? 'Scannen...' : 'Ausweis scannen'}
                    </Button>
                    <Button
                      onClick={() => setCapturedImage(null)}
                      variant="outline"
                    >
                      Neu aufnehmen
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <Button
                onClick={handleCheckIn}
                disabled={!idData}
                data-testid="confirm-checkin-button"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
              >
                <Check size={20} weight="bold" className="mr-2" />
                Check-In bestätigen
              </Button>
              <Button
                onClick={() => setShowScanner(false)}
                variant="outline"
              >
                Abbrechen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
