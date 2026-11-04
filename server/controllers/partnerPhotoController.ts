import { Request, Response, NextFunction } from 'express';
import { PartnerStore } from '../services/partnerStore.ts';
import { deletePartnerProfilePhoto, storePartnerProfilePhoto } from '../services/profilePhotoStorage.ts';

const partnerRecordId = (req: Request) => String(req.user?._id || req.user?.id || '');

async function discardPhoto(publicId: string): Promise<void> {
  try { await deletePartnerProfilePhoto(publicId); } catch { /* Best-effort cleanup; never expose provider details. */ }
}

export const uploadPartnerProfilePhoto = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ success: false, message: 'Choose a PNG, JPEG, or WebP image up to 3 MB.' });
    return;
  }

  let stored: { url: string; publicId: string } | undefined;
  try {
    const id = partnerRecordId(req);
    const previous = await PartnerStore.getProfilePhotoRef(id);
    if (!previous) {
      res.status(404).json({ success: false, message: 'Partner profile not found.' });
      return;
    }

    stored = await storePartnerProfilePhoto(req.file.buffer);
    let partner;
    try {
      partner = await PartnerStore.setProfilePhoto(id, stored.url, stored.publicId);
    } catch (error) {
      await discardPhoto(stored.publicId);
      next(error);
      return;
    }
    if (!partner) {
      await discardPhoto(stored.publicId);
      res.status(404).json({ success: false, message: 'Partner profile not found.' });
      return;
    }
    if (previous.publicId && previous.publicId !== stored.publicId) await discardPhoto(previous.publicId);
    res.status(200).json({ success: true, message: 'Profile photo updated.', data: partner });
  } catch (error) { next(error); }
};

export const removePartnerProfilePhoto = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = partnerRecordId(req);
    const previous = await PartnerStore.getProfilePhotoRef(id);
    if (!previous) {
      res.status(404).json({ success: false, message: 'Partner profile not found.' });
      return;
    }
    const partner = await PartnerStore.clearProfilePhoto(id);
    if (!partner) {
      res.status(404).json({ success: false, message: 'Partner profile not found.' });
      return;
    }
    if (previous.publicId) await discardPhoto(previous.publicId);
    res.status(200).json({ success: true, message: 'Profile photo removed.', data: partner });
  } catch (error) { next(error); }
};
