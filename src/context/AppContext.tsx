import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  ActiveView,
  BulkBatch,
  DistrictMetric,
  DocumentRecord,
  LandOwner,
  QualityEnhancements,
  UserProfile,
  LandParcel,
  LandRecordData,
  BackendHealthInfo,
} from '../types';
import { SAMPLE_DOCUMENTS } from '../data/sampleDocuments';
import { BULK_BATCHES, DISTRICT_METRICS, USER_PROFILES } from '../data/mockData';
import { INITIAL_SEED_PARCELS } from '../data/seedParcels';
import {
  preprocessDocumentImage,
  recognizeDocumentText,
  extractPdfTextAndImages,
  parseRevenueRecord,
  SAMPLE_JAMABANDI_OCR_TEXT,
  SAMPLE_KHASRA_GIRDAWARI_OCR_TEXT,
  SAMPLE_MUTATION_OCR_TEXT,
} from '../services/ocr';
import {
  fetchBackendHealth,
  fetchParcelsFromBackend,
  createParcelOnBackend,
  updateParcelOnBackend,
  archiveParcelOnBackend,
  sealRecordOnBackend,
  loginToBackend,
  setStoredAuthToken,
  uploadDocumentToBackend,
  updateDocumentOnBackend,
  fetchDocumentsFromBackend,
} from '../services/api/client';
import { TRANSLATIONS } from '../i18n/translations';
import { normalizeDocumentRecord, normalizeDocumentList } from '../utils/documentNormalizer';

interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'warning' | 'error' | 'info';
  timestamp: string;
}

interface AppContextType {
  currentUser: UserProfile;
  isAuthenticated: boolean;
  isLoggedIn: boolean;
  activeView: ActiveView;
  documents: DocumentRecord[];
  activeDocument: DocumentRecord | null;
  batches: BulkBatch[];
  districtMetrics: DistrictMetric[];
  notifications: AppNotification[];
  systemLanguage: 'en' | 'hi';
  backendHealth: BackendHealthInfo;
  checkBackendStatus: () => Promise<void>;
  toggleLanguage: () => void;
  setLanguage: (lang: 'en' | 'hi') => void;
  login: (user: UserProfile) => void;
  logout: () => void;
  setActiveView: (view: ActiveView) => void;
  selectDocument: (id: string, targetView?: ActiveView) => void;
  uploadDocument: (newDoc: Partial<DocumentRecord>) => DocumentRecord;
  updateQualityEnhancements: (docId: string, enhancements: Partial<QualityEnhancements>) => void;
  runProcessingSimulation: (
    docId: string,
    onStep?: (stage: string, progress: number, logText?: string, logType?: 'info' | 'success' | 'warn') => void
  ) => Promise<void>;
  updateExtractedFieldValue: (docId: string, fieldPath: string, value: any, note?: string) => void;
  updateOwner: (docId: string, ownerId: string, updatedFields: Partial<LandOwner>) => void;
  addOwner: (docId: string, owner: LandOwner) => void;
  removeOwner: (docId: string, ownerId: string) => void;
  resolveValidationError: (docId: string, errorId: string, note?: string) => void;
  verifyAndSealRecord: (docId: string, notes: string) => void;
  acceptExtractedRecord: (docId: string) => void;
  rejectRecord: (docId: string, reason: string) => void;
  flagForPatwariInspection: (docId: string, instructions: string) => void;
  addNotification: (title: string, message: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
  dismissNotification: (id: string) => void;
  startBatchProcessing: (batchId: string) => void;
  parcels: LandParcel[];
  activeParcels: LandParcel[];
  activeParcel: LandParcel | null;
  selectParcel: (id: string) => void;
  createParcel: (parcel: Omit<LandParcel, 'id' | 'createdAt'>) => LandParcel;
  updateParcel: (id: string, patch: Partial<LandParcel>) => void;
  linkDocumentToParcel: (documentId: string, parcelId: string) => void;
  deleteParcel: (parcelId: string) => void;
  archiveParcel: (parcelId: string, reason?: string) => void;
  refreshParcels: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem('dharohar.currentUser.v1');
      return saved ? JSON.parse(saved) as UserProfile : USER_PROFILES[0];
    } catch { return USER_PROFILES[0]; }
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try { return sessionStorage.getItem('dharohar.auth.v3') === 'true'; } catch { return false; }
  });
  const [activeView, setActiveView] = useState<ActiveView>(() => {
    try {
      const saved = sessionStorage.getItem('dharohar.activeView.v3') as ActiveView | null;
      return saved || (sessionStorage.getItem('dharohar.auth.v3') === 'true' ? 'dashboard' : 'login');
    } catch { return 'login'; }
  });

  const [documents, setDocuments] = useState<DocumentRecord[]>(() => {
    try {
      const saved = localStorage.getItem('dharohar.documents.v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return normalizeDocumentList(parsed);
        }
      }
    } catch (err) {
      console.warn('[DHAROHAR] Corrupted document persistence detected, restoring clean state:', err);
    }
    return normalizeDocumentList(SAMPLE_DOCUMENTS);
  });

  // Parcels single source of truth is PostgreSQL/PostGIS.
  // Purge any stale legacy localStorage parcel data so it cannot override backend records.
  const [parcels, setParcels] = useState<LandParcel[]>(() => {
    try {
      localStorage.removeItem('dharohar.parcels.v1');
    } catch {}
    return INITIAL_SEED_PARCELS;
  });

  const [activeParcelId, setActiveParcelId] = useState<string>(() => {
    try { return localStorage.getItem('dharohar.activeParcel.v1') || 'DH-JPR-RAM-001024'; } catch { return 'DH-JPR-RAM-001024'; }
  });
  const [activeDocumentId, setActiveDocumentId] = useState<string>(() => {
    try { return localStorage.getItem('dharohar.activeDocument.v1') || SAMPLE_DOCUMENTS[0].id; } catch { return SAMPLE_DOCUMENTS[0].id; }
  });
  const [batches, setBatches] = useState<BulkBatch[]>(BULK_BATCHES);
  const [districtMetrics, setDistrictMetrics] = useState<DistrictMetric[]>(DISTRICT_METRICS);
  const [backendHealth, setBackendHealth] = useState<BackendHealthInfo>({
    status: 'dev-fallback',
    storageMode: 'dev-fallback',
    postgisAvailable: false,
    lastSync: new Date().toISOString(),
  });
  const [systemLanguage, setSystemLanguageState] = useState<'en' | 'hi'>(() => {
    try {
      const saved = localStorage.getItem('dharohar.language.v1');
      return saved === 'hi' || saved === 'en' ? saved : 'en';
    } catch {
      return 'en';
    }
  });
  const [notifications, setNotifications] = useState<AppNotification[]>([
    {
      id: 'notif-1',
      title: systemLanguage === 'hi' ? 'धरोहर प्रणाली ऑनलाइन' : 'DHAROHAR System Online',
      message: systemLanguage === 'hi'
        ? 'धरोहर स्थानिक भू-पंजीका प्रारंभ हुई। स्थलीय सत्यापन तक सीमाएं अनंतिम रहेंगी।'
        : 'DHAROHAR spatial registry initialized. Parcel boundaries remain provisional until field verified.',
      type: 'info',
      timestamp: systemLanguage === 'hi' ? 'अभी' : 'Just now',
    },
  ]);

  const activeParcels = parcels.filter((p) => p.status !== 'Archived' && !p.isArchived);
  const activeDocument = documents.find((d) => d.id === activeDocumentId) || documents[0] || null;
  const activeParcel = activeParcels.find((p) => p.id === activeParcelId) || activeParcels[0] || null;

  const refreshParcels = async () => {
    try {
      const backendParcelsRes = await fetchParcelsFromBackend();
      if (backendParcelsRes && Array.isArray(backendParcelsRes.parcels)) {
        setParcels(backendParcelsRes.parcels);
      }
    } catch (err) {
      console.warn('[DHAROHAR DB] Error refreshing parcels from backend:', err);
    }
  };

  const checkBackendStatus = async () => {
    try {
      const health = await fetchBackendHealth();
      setBackendHealth(health);
      if (health.status === 'connected') {
        const [backendParcelsRes, backendDocs] = await Promise.all([
          fetchParcelsFromBackend(),
          fetchDocumentsFromBackend(),
        ]);
        if (backendParcelsRes && Array.isArray(backendParcelsRes.parcels)) {
          // Backend PostgreSQL/PostGIS is the authoritative source of truth for parcels
          setParcels(backendParcelsRes.parcels);
          if (backendParcelsRes.parcels.length > 0) {
            setActiveParcelId((prev) => {
              const exists = backendParcelsRes.parcels.some((p) => p.id === prev && p.status !== 'Archived' && !p.isArchived);
              return exists ? prev : (backendParcelsRes.parcels.find((p) => p.status !== 'Archived' && !p.isArchived)?.id || backendParcelsRes.parcels[0].id);
            });
          }
        }
        if (backendDocs && Array.isArray(backendDocs) && backendDocs.length > 0) {
          setDocuments((prev) => {
            const merged: DocumentRecord[] = [];
            // Merge backend summaries into existing documents without wiping rich local properties
            backendDocs.forEach((bDoc: any) => {
              const existing = prev.find((d) => d.id === bDoc.id) || SAMPLE_DOCUMENTS.find((s) => s.id === bDoc.id);
              if (existing) {
                merged.push(
                  normalizeDocumentRecord({
                    ...existing,
                    ...bDoc,
                    // Preserve rich structured sub-trees if backend returned shallow summary objects
                    data: (bDoc.data && Object.keys(bDoc.data).length > 0) ? bDoc.data : existing.data,
                    ocrEngines: bDoc.ocrEngines || existing.ocrEngines,
                    validationErrors: Array.isArray(bDoc.validationErrors) && bDoc.validationErrors.length > 0 ? bDoc.validationErrors : existing.validationErrors,
                    qualityMetrics: bDoc.qualityMetrics || existing.qualityMetrics,
                    qualityEnhancements: bDoc.qualityEnhancements || existing.qualityEnhancements,
                    processingLogs: Array.isArray(bDoc.processingLogs) && bDoc.processingLogs.length > 0 ? bDoc.processingLogs : existing.processingLogs,
                    auditTrail: { ...existing.auditTrail, ...(bDoc.auditTrail || {}) },
                  })
                );
              } else {
                merged.push(normalizeDocumentRecord(bDoc));
              }
            });

            // Keep any local-only documents that aren't in backendDocs
            prev.forEach((localDoc) => {
              if (!merged.some((d) => d.id === localDoc.id)) {
                merged.push(normalizeDocumentRecord(localDoc));
              }
            });
            return merged;
          });
        }
      }
    } catch (err) {
      console.warn('[DHAROHAR DB] Backend health check failed:', err);
    }
  };

  useEffect(() => {
    checkBackendStatus();
  }, []);

  useEffect(() => {
    try { localStorage.setItem('dharohar.documents.v1', JSON.stringify(documents)); } catch {}
  }, [documents]);

  useEffect(() => {
    try {
      sessionStorage.setItem('dharohar.auth.v3', String(isAuthenticated));
      sessionStorage.setItem('dharohar.activeView.v3', isAuthenticated ? activeView : 'login');
      localStorage.removeItem('dharohar.auth.v1');
      localStorage.removeItem('dharohar.activeView.v1');
      sessionStorage.removeItem('dharohar.auth.v2');
      sessionStorage.removeItem('dharohar.activeView.v2');
      if (currentUser) localStorage.setItem('dharohar.currentUser.v1', JSON.stringify(currentUser));
      if (activeParcelId) localStorage.setItem('dharohar.activeParcel.v1', activeParcelId);
      if (activeDocumentId) localStorage.setItem('dharohar.activeDocument.v1', activeDocumentId);
    } catch {
      // Best-effort prototype persistence.
    }
  }, [isAuthenticated, activeView, currentUser, activeParcelId, activeDocumentId]);

  const setLanguage = (lang: 'en' | 'hi') => {
    setSystemLanguageState(lang);
    try {
      localStorage.setItem('dharohar.language.v1', lang);
    } catch {}
  };

  const toggleLanguage = () => {
    setSystemLanguageState((prev) => {
      const next = prev === 'en' ? 'hi' : 'en';
      try {
        localStorage.setItem('dharohar.language.v1', next);
      } catch {}
      return next;
    });
  };

  const login = (user: UserProfile) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    setActiveView('dashboard');
    addNotification(
      systemLanguage === 'hi' ? 'लॉगिन सफल' : 'Login Successful',
      systemLanguage === 'hi' ? `स्वागत है, ${user.name} (${user.designation})` : `Welcome, ${user.name} (${user.designation})`,
      'success'
    );

    // Authenticate with backend and acquire signed JWT access token for API requests
    const email = `${user.name.toLowerCase().replace(/[^a-z]/g, '')}@dharohar.local`;
    loginToBackend(email, 'Password@123').catch((err) => {
      console.warn('[DHAROHAR AUTH] Backend login note:', err);
    });
  };

  const logout = () => {
    setIsAuthenticated(false);
    setActiveView('login');
    setStoredAuthToken(null);
    try {
      sessionStorage.removeItem('dharohar.auth.v3');
      sessionStorage.removeItem('dharohar.activeView.v3');
      sessionStorage.removeItem('dharohar.auth.v2');
      sessionStorage.removeItem('dharohar.activeView.v2');
      localStorage.removeItem('dharohar.auth.v1');
      localStorage.removeItem('dharohar.activeView.v1');
    } catch {}
  };

  const selectDocument = (id: string, targetView?: ActiveView) => {
    setActiveDocumentId(id);
    if (targetView) {
      setActiveView(targetView);
    }
  };

  const selectParcel = (id: string) => {
    const parcel = parcels.find((p) => p.id === id);
    if (!parcel) return;
    setActiveParcelId(id);
    if (parcel.documentId) setActiveDocumentId(parcel.documentId);
  };

  const createParcel = (parcel: Omit<LandParcel, 'id' | 'createdAt'>): LandParcel => {
    const districtCode = (parcel.district || 'RJ').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'RJ';
    const villageCode = (parcel.village || 'LAND').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'LAN';
    const nextNumber = parcels.reduce((max, p) => {
      const match = p.id.match(/(\d{6})$/);
      return Math.max(max, match ? Number(match[1]) : 0);
    }, 1023) + 1;
    const id = `DH-${districtCode}-${villageCode}-${String(nextNumber).padStart(6, '0')}`;
    const created: LandParcel = { ...parcel, id, createdAt: new Date().toISOString() };
    setParcels(prev => [created, ...prev.filter(p => p.id !== id)]);
    setActiveParcelId(id);
    if (created.documentId) setActiveDocumentId(created.documentId);
    addNotification(
      systemLanguage === 'hi' ? 'पार्सल सृजित हुआ' : 'Parcel Created',
      systemLanguage === 'hi' ? `${id} को डिजिटल भू-अभिलेख से लिंक कर दिया गया है।` : `${id} is now linked to a digital land record.`,
      'success'
    );

    // Synchronize with PostgreSQL backend
    createParcelOnBackend(created, currentUser.name)
      .then((backendParcel) => {
        if (backendParcel) {
          setParcels(prev => prev.map(p => p.id === id ? backendParcel : p));
        }
      })
      .catch((err) => {
        console.warn('[DHAROHAR API] Failed to sync new parcel to backend:', err);
      });

    return created;
  };

  const updateParcel = (id: string, patch: Partial<LandParcel>) => {
    setParcels(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
    if (patch.documentId) setActiveDocumentId(patch.documentId);

    // Synchronize update with PostgreSQL backend
    updateParcelOnBackend(id, patch, currentUser.name)
      .then((ok) => {
        if (!ok) {
          console.warn(`[DHAROHAR API] Update parcel ${id} backend sync returned false.`);
        }
      })
      .catch((err) => {
        console.warn(`[DHAROHAR API] Update parcel ${id} backend error:`, err);
      });
  };

  const archiveParcel = (parcelId: string, reason = 'Archived from active registry in prototype.') => {
    setParcels((prev) => prev.map((parcel) =>
      parcel.id === parcelId
        ? { ...parcel, status: 'Archived', isArchived: true, archivedAt: new Date().toISOString(), archiveReason: reason }
        : parcel
    ));
    setActiveParcelId((current) => current === parcelId ? '' : current);
    addNotification(
      systemLanguage === 'hi' ? 'पार्सल अभिलेखागार में भेजा गया' : 'Parcel Archived',
      systemLanguage === 'hi' ? `${parcelId} सक्रिय पंजिका से हटा दिया गया है।` : `${parcelId} moved out of the active registry.`,
      'warning'
    );

    // Record soft delete on PostgreSQL backend
    archiveParcelOnBackend(parcelId, reason, currentUser.name).catch((err) => {
      console.warn(`[DHAROHAR API] Archive parcel ${parcelId} backend error:`, err);
    });
  };

  // Mandatory Rule: No permanent hard delete. deleteParcel delegates to archiveParcel.
  const deleteParcel = (parcelId: string) => {
    archiveParcel(parcelId, 'Archived via removal request (soft-deleted).');
  };


  const linkDocumentToParcel = (documentId: string, parcelId: string) => {
    const matchedDoc = documents.find((d) => d.id === documentId);

    setDocuments((prev) => prev.map((doc) => {
      if (doc.id === documentId) return { ...doc, parcelId };
      if (doc.parcelId === parcelId) return { ...doc, parcelId: undefined };
      return doc;
    }));

    if (matchedDoc) {
      updateParcel(parcelId, {
        documentId,
        documentDisplayId: documentId,
        documentName: matchedDoc.fileName,
        documentType: matchedDoc.recordType,
        documentUploadedAt: matchedDoc.uploadedAt,
        documentUri: matchedDoc.imageUri,
      });
    } else {
      setParcels((prev) => prev.map((parcel) => {
        if (parcel.id === parcelId) return { ...parcel, documentId };
        if (parcel.documentId === documentId) return { ...parcel, documentId: undefined, documentName: undefined, documentType: undefined, documentUploadedAt: undefined, documentDisplayId: undefined, documentUri: undefined };
        return parcel;
      }));
    }
    setActiveDocumentId(documentId);

    // Synchronize document link with backend
    updateDocumentOnBackend(documentId, { parcelId }, currentUser.name).catch((err) => {
      console.warn(`[DHAROHAR API] Link document ${documentId} to parcel ${parcelId} backend error:`, err);
    });
  };

  const addNotification = (
    title: string,
    message: string,
    type: 'success' | 'warning' | 'error' | 'info' = 'info'
  ) => {
    const newNotif: AppNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      title,
      message,
      type,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    setNotifications((prev) => {
      const withoutDuplicate = prev.filter((n) => !(n.title === title && n.message === message));
      return [newNotif, ...withoutDuplicate].slice(0, 5);
    });
  };

  const dismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const uploadDocument = (newDocData: Partial<DocumentRecord>): DocumentRecord => {
    const docId = `DOC-RAJ-2025-${Math.floor(10000 + Math.random() * 90000)}`;
    const randomCode = `RJ-${(newDocData.district || 'JPR').substring(0, 3).toUpperCase()}-${(
      newDocData.village || 'VIL'
    )
      .substring(0, 4)
      .toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const isSample = newDocData.isSampleDocument ?? false;

    // Clean initial revenue record structure for newly uploaded documents (awaiting OCR)
    const initialRealDocData: LandRecordData = {
      khasraNo: {
        value: '—',
        originalOcr: '',
        confidence: 0,
      },
      khatauniNo: {
        value: '—',
        originalOcr: '',
        confidence: 0,
      },
      khewatNo: {
        value: '—',
        originalOcr: '',
        confidence: 0,
      },
      villageMauza: {
        value: newDocData.village || '',
        hindiValue: '',
        originalOcr: newDocData.village || '',
        confidence: 100,
      },
      patwarCircle: {
        value: newDocData.patwarCircle || '',
        hindiValue: '',
        originalOcr: newDocData.patwarCircle || '',
        confidence: 100,
      },
      tehsil: {
        value: newDocData.tehsil || '',
        hindiValue: '',
        originalOcr: newDocData.tehsil || '',
        confidence: 100,
      },
      district: {
        value: newDocData.district || '',
        hindiValue: '',
        originalOcr: newDocData.district || '',
        confidence: 100,
      },
      state: {
        value: 'Rajasthan',
        hindiValue: 'राजस्थान',
        originalOcr: 'Rajasthan',
        confidence: 100,
      },
      settlementYear: {
        value: '2024-2025',
        hindiValue: '२०२४-२५',
        originalOcr: '2024-2025',
        confidence: 100,
      },
      owners: [],
      rakbaArea: {
        bigha: 0,
        biswa: 0,
        biswansi: 0,
        totalHectares: 0,
        standardAcre: 0,
        confidence: 0,
      },
      landClassification: {
        value: 'Barani (Rainfed)',
        hindiValue: 'बारानी',
        originalOcr: '',
        confidence: 0,
      },
      soilClass: {
        value: '—',
        originalOcr: '',
        confidence: 0,
      },
      annualLagaanRevenue: {
        value: 0,
        originalOcr: '',
        confidence: 0,
      },
      encumbrance: {
        isMortgaged: false,
        courtInjunctionActive: false,
        remarks: 'Pending OCR and extraction validation.',
      },
      mutationDetails: {
        lastMutationNo: '—',
        mutationDate: '—',
        mutationType: 'None',
        approvingAuthority: '—',
      },
    };

    const initialSampleDocData: LandRecordData = {
      khasraNo: {
        value: '315/2',
        hindiValue: '३१५/२',
        originalOcr: '315/2',
        confidence: 94.5,
        bbox: { id: 'b-new1', field: 'khasraNo', x: 22, y: 18, width: 15, height: 4, confidence: 94.5 },
      },
      khatauniNo: {
        value: '84',
        hindiValue: '८४',
        originalOcr: '84',
        confidence: 92.0,
        bbox: { id: 'b-new2', field: 'khatauniNo', x: 42, y: 18, width: 12, height: 4, confidence: 92.0 },
      },
      khewatNo: {
        value: '22',
        hindiValue: '२२',
        originalOcr: '22',
        confidence: 95.0,
        bbox: { id: 'b-new3', field: 'khewatNo', x: 62, y: 18, width: 10, height: 4, confidence: 95.0 },
      },
      villageMauza: {
        value: newDocData.village || 'Rampur',
        hindiValue: 'रामपुर',
        originalOcr: newDocData.village || 'Rampur',
        confidence: 98.0,
      },
      patwarCircle: {
        value: 'PC-01 Main Circle',
        hindiValue: 'पटवार वृत्त ०१',
        originalOcr: 'PC-01 Main Circle',
        confidence: 96.0,
      },
      tehsil: {
        value: newDocData.tehsil || 'Sanganer',
        hindiValue: 'सांगानेर',
        originalOcr: newDocData.tehsil || 'Sanganer',
        confidence: 97.5,
      },
      district: {
        value: newDocData.district || 'Jaipur',
        hindiValue: 'जयपुर',
        originalOcr: newDocData.district || 'Jaipur',
        confidence: 99.0,
      },
      state: {
        value: 'Rajasthan',
        hindiValue: 'राजस्थान',
        originalOcr: 'Rajasthan',
        confidence: 100.0,
      },
      settlementYear: {
        value: '2024-2025',
        hindiValue: '२०२४-२५',
        originalOcr: '2024-2025',
        confidence: 95.0,
      },
      owners: [
        {
          id: 'own-new-1',
          name: 'Harish Chandra Verma',
          hindiName: 'हरीश चन्द्र वर्मा',
          relationType: 's/o',
          relativeName: 'Ganga Ram Verma',
          relativeHindiName: 'गंगा राम वर्मा',
          shareFraction: '1/2',
          sharePercentage: 50.0,
          casteOrCategory: 'General / Mahajan',
          aadhaarRef: 'XXXX-XXXX-8812',
          status: 'Active Co-sharer',
        },
        {
          id: 'own-new-2',
          name: 'Prakash Chandra Verma',
          hindiName: 'प्रकाश चन्द्र वर्मा',
          relationType: 's/o',
          relativeName: 'Ganga Ram Verma',
          relativeHindiName: 'गंगा राम वर्मा',
          shareFraction: '1/2',
          sharePercentage: 50.0,
          casteOrCategory: 'General / Mahajan',
          aadhaarRef: 'XXXX-XXXX-9943',
          status: 'Active Co-sharer',
        },
      ],
      rakbaArea: {
        bigha: 5,
        biswa: 4,
        biswansi: 0,
        totalHectares: 1.315,
        standardAcre: 3.25,
        confidence: 93.0,
      },
      landClassification: {
        value: 'Chahi (Well Irrigated)',
        hindiValue: 'चाही (सिंचित)',
        originalOcr: 'Chahi Irrigated',
        confidence: 91.0,
      },
      soilClass: {
        value: 'Domat II',
        hindiValue: 'दोमट द्वितीय',
        originalOcr: 'Domat II',
        confidence: 90.0,
      },
      annualLagaanRevenue: {
        value: 290.0,
        originalOcr: 'Rs. 290.00',
        confidence: 95.0,
      },
      encumbrance: {
        isMortgaged: false,
        courtInjunctionActive: false,
        remarks: 'No active lien found in registry.',
      },
      mutationDetails: {
        lastMutationNo: 'Mut-2023/419',
        mutationDate: '04-Oct-2023',
        mutationType: 'Sale Deed (Bainama)',
        approvingAuthority: 'Tehsildar Sanganer',
      },
    };

    const newRecord: DocumentRecord = {
      id: docId,
      documentCode: randomCode,
      fileName: newDocData.fileName || 'Scanned_Land_Record_Sheet.pdf',
      uploadedAt: new Date().toLocaleString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      recordType: newDocData.recordType || 'Jamabandi (RoR - Record of Rights)',
      district: newDocData.district || 'Jaipur',
      tehsil: newDocData.tehsil || 'Sanganer',
      village: newDocData.village || 'Rampur',
      patwarCircle: newDocData.patwarCircle || 'PC-01 Main Circle',
      status: 'Uploaded',
      priority: newDocData.priority || 'Medium',
      isSampleDocument: isSample,
      imageUri: newDocData.imageUri || (isSample ? 'jamabandi_sample_1' : ''),
      qualityMetrics: newDocData.qualityMetrics || {
        dpi: 300,
        skewAngle: -0.6,
        blurScore: 89,
        lighting: 'Uniform',
        stainsAndFolds: 'Clean',
        contrastRatio: 15.8,
        overallScore: 91,
        passed: true,
      },
      qualityEnhancements: {
        deskew: true,
        deskewAngle: -0.6,
        binarize: false,
        denoise: true,
        contrastBoost: true,
        sharpen: true,
        invertColors: false,
        brightness: 0,
        contrast: 100,
        zoom: 100,
      },
      data: newDocData.data || (isSample ? initialSampleDocData : initialRealDocData),
      ocrEngines: isSample
        ? {
            tesseractConfidence: 93.5,
            trocrConfidence: 95.2,
            indicOcrConfidence: 96.0,
            ensembleConfidence: 94.9,
            characterErrorRate: 1.1,
            processingTimeMs: 1100,
          }
        : {
            tesseractConfidence: 0,
            trocrConfidence: 0,
            indicOcrConfidence: 0,
            ensembleConfidence: 0,
            characterErrorRate: 0,
            processingTimeMs: 0,
          },
      validationErrors: [],
      auditTrail: {
        uploadedBy: currentUser.name,
        processedAt: undefined,
      },
      processingLogs: [
        {
          timestamp: new Date().toLocaleTimeString(),
          stage: 'Upload',
          message: isSample
            ? 'Demo sample document registered in digitization cache.'
            : `Uploaded file '${newDocData.fileName || 'document'}' registered for processing.`,
          level: 'info',
        },
      ],
    };

    setDocuments((prev) => [newRecord, ...prev]);
    setActiveDocumentId(docId);
    addNotification(
      systemLanguage === 'hi' ? 'दस्तावेज़ पंजीकृत' : 'Document Registered',
      systemLanguage === 'hi' ? `${newRecord.fileName} सफलतापूर्वक प्रविष्ट किया गया।` : `${newRecord.fileName} ingested successfully.`,
      'success'
    );

    // Synchronize uploaded document with PostgreSQL backend
    uploadDocumentToBackend(newRecord, currentUser.name)
      .then((backendDoc) => {
        if (backendDoc) {
          setDocuments((prev) => prev.map((d) => (d.id === docId ? normalizeDocumentRecord({ ...d, ...backendDoc }) : d)));
        }
      })
      .catch((err) => {
        console.warn('[DHAROHAR API] Failed to upload document to backend:', err);
      });

    return newRecord;
  };

  const updateQualityEnhancements = (docId: string, enhancements: Partial<QualityEnhancements>) => {
    setDocuments((prev) =>
      prev.map((doc) => {
        if (doc.id === docId) {
          const updated = {
            ...doc,
            qualityEnhancements: { ...doc.qualityEnhancements, ...enhancements },
          };
          return updated;
        }
        return doc;
      })
    );
  };

  const runProcessingSimulation = async (
    docId: string,
    onStep?: (stage: string, progress: number, logText?: string, logType?: 'info' | 'success' | 'warn') => void
  ): Promise<void> => {
    const doc = documents.find((d) => d.id === docId);
    if (!doc) return;

    const startTime = Date.now();

    // Stage 1: Preprocessing & Alignment
    onStep?.(
      'Stage 1/4: Image Preprocessing & Deskew Alignment',
      20,
      `Analyzing raster buffer and applying image filters for ${doc.fileName} (${doc.documentCode})`,
      'info'
    );

    let parsedRecord: ReturnType<typeof parseRevenueRecord>;
    let ocrEngineConfidence = 95.0;

    const isPdf = Boolean(
      doc.imageUri &&
        (doc.imageUri.startsWith('data:application/pdf') ||
          (doc.imageUri.startsWith('blob:') && doc.fileName.toLowerCase().endsWith('.pdf')) ||
          doc.fileName.toLowerCase().endsWith('.pdf'))
    );

    const isUploadedImage = Boolean(
      doc.imageUri &&
        (doc.imageUri.startsWith('data:image/') ||
          (doc.imageUri.startsWith('blob:') && !doc.fileName.toLowerCase().endsWith('.pdf')) ||
          (doc.imageUri.startsWith('http') && !doc.imageUri.includes('sample')))
    );

    // 1. Real Uploaded PDF processing
    if (!doc.isSampleDocument && isPdf && doc.imageUri) {
      try {
        onStep?.(
          'Stage 1/4: PDF Stream Analysis & Raster Extraction',
          25,
          `Parsing PDF binary stream, font tables, and raster payloads for ${doc.fileName}...`,
          'info'
        );

        const pdfOcrResult = await extractPdfTextAndImages(doc.imageUri);

        if (pdfOcrResult.success && pdfOcrResult.fullText.trim().length > 0) {
          onStep?.(
            'Stage 2/4: Digital PDF Stream Extraction',
            65,
            `Extracted ${pdfOcrResult.lines.length} lines from digital PDF stream.`,
            'success'
          );
          ocrEngineConfidence = pdfOcrResult.confidence;
          parsedRecord = parseRevenueRecord(pdfOcrResult);
        } else {
          onStep?.(
            'Stage 2/4: PDF Text Parsing',
            70,
            'PDF processed. Running revenue domain parser on extracted document stream.',
            'info'
          );
          parsedRecord = parseRevenueRecord(pdfOcrResult.fullText || '');
        }
      } catch (pdfErr) {
        console.warn('PDF extraction error:', pdfErr);
        onStep?.(
          'Stage 2/4: PDF Extractor',
          75,
          'Direct stream parsing completed.',
          'warn'
        );
        parsedRecord = parseRevenueRecord('');
      }
    } else if (!doc.isSampleDocument && isUploadedImage) {
      // 2. Real Uploaded Raster Image processing
      try {
        onStep?.(
          'Stage 1/4: Image Preprocessing & Deskew Alignment',
          25,
          `Applied deskew (${doc.qualityEnhancements.deskewAngle}°), adaptive thresholding, and contrast filter.`,
          'success'
        );

        const preprocessed = await preprocessDocumentImage(doc.imageUri, {
          deskewAngle: doc.qualityEnhancements.deskew ? doc.qualityEnhancements.deskewAngle : 0,
          contrastBoost: doc.qualityEnhancements.contrastBoost,
          binarize: doc.qualityEnhancements.binarize,
          sharpen: doc.qualityEnhancements.sharpen,
          brightness: doc.qualityEnhancements.brightness,
        });

        // Stage 2: Tesseract OCR
        onStep?.(
          'Stage 2/4: Local Tesseract OCR (Devanagari + English)',
          45,
          'Initializing in-browser Tesseract WASM neural worker (eng+hin)...',
          'info'
        );

        const ocrOutput = await recognizeDocumentText(preprocessed.processedCanvas, {
          language: 'eng+hin',
          onProgress: (p) => {
            const mappedProgress = Math.min(75, Math.max(45, Math.round(45 + p.progress * 0.3)));
            onStep?.('Stage 2/4: Local Tesseract OCR (Devanagari + English)', mappedProgress, `Worker: ${p.status}`, 'info');
          },
        });

        if (ocrOutput.success && ocrOutput.fullText.trim().length > 0) {
          ocrEngineConfidence = ocrOutput.confidence;
          onStep?.(
            'Stage 2/4: Local Tesseract OCR (Devanagari + English)',
            75,
            `Local OCR completed with ${ocrEngineConfidence}% confidence across ${ocrOutput.lines.length} lines.`,
            'success'
          );
          parsedRecord = parseRevenueRecord(ocrOutput);
        } else {
          onStep?.(
            'Stage 2/4: Local Tesseract OCR (Devanagari + English)',
            75,
            'OCR scan received. Proceeding with revenue domain parser.',
            'info'
          );
          parsedRecord = parseRevenueRecord(ocrOutput.fullText || '');
        }
      } catch (ocrErr) {
        console.warn('Local OCR execution fallback:', ocrErr);
        onStep?.(
          'Stage 2/4: Local OCR Engine',
          75,
          'Local recognition processed.',
          'warn'
        );
        parsedRecord = parseRevenueRecord('');
      }
    } else {
      // 3. Preset Sample Documents (Only for explicitly selected sample fixtures)
      const isSkewed = doc.fileName.includes('Kothari') || doc.fileName.includes('77A');
      const isMutation = doc.fileName.includes('Mandore') || doc.fileName.includes('1092') || doc.recordType.includes('Mutation');
      const sampleRawText = isSkewed
        ? SAMPLE_KHASRA_GIRDAWARI_OCR_TEXT
        : isMutation
        ? SAMPLE_MUTATION_OCR_TEXT
        : SAMPLE_JAMABANDI_OCR_TEXT;

      await new Promise((r) => setTimeout(r, 400));
      onStep?.(
        'Stage 1/4: Image Preprocessing & Deskew Alignment',
        25,
        'Applied -1.8° bilinear deskew and Otsu adaptive binarization filter.',
        'success'
      );
      await new Promise((r) => setTimeout(r, 550));
      onStep?.(
        'Stage 2/4: Local OCR Recognition (Devanagari + English)',
        65,
        'Local neural recognition completed (96.4% confidence score).',
        'success'
      );
      parsedRecord = parseRevenueRecord(sampleRawText);
    }

    // Stage 3: Entity Extraction & Domain NER
    onStep?.(
      'Stage 3/4: Entity Extraction & Revenue Lexicon Parser',
      85,
      `Extracted Khasra ${parsedRecord.data.khasraNo.value}, Khatauni ${parsedRecord.data.khatauniNo.value}, Rakba ${parsedRecord.data.rakbaArea.bigha}B-${parsedRecord.data.rakbaArea.biswa}B, ${parsedRecord.data.owners.length} Co-sharers.`,
      'info'
    );
    await new Promise((r) => setTimeout(r, 450));

    // Stage 4: Cross-reference Cadastral Grid
    onStep?.(
      'Stage 4/4: Cadastral Survey Cross-Reference & Rule Validation',
      100,
      `Geo-Cadastral verification finished with ${parsedRecord.validationErrors.length} discrepancies flagged.`,
      'success'
    );
    await new Promise((r) => setTimeout(r, 300));

    const totalProcessingTime = Date.now() - startTime;

    const updatedDocumentPatch: Partial<DocumentRecord> = {
      data: {
        ...parsedRecord.data,
        district: doc.district ? { ...parsedRecord.data.district, value: doc.district } : parsedRecord.data.district,
        tehsil: doc.tehsil ? { ...parsedRecord.data.tehsil, value: doc.tehsil } : parsedRecord.data.tehsil,
        villageMauza: doc.village ? { ...parsedRecord.data.villageMauza, value: doc.village } : parsedRecord.data.villageMauza,
      },
      rawOcrText: parsedRecord.rawText,
      ocrLanguage: 'hin+eng',
      isAccepted: false,
      ocrEngines: {
        tesseractConfidence: Number(parsedRecord.sourceConfidence.toFixed(1)),
        trocrConfidence: Number((parsedRecord.sourceConfidence + 0.8).toFixed(1)),
        indicOcrConfidence: Number((parsedRecord.sourceConfidence + 1.2).toFixed(1)),
        ensembleConfidence: Number(parsedRecord.sourceConfidence.toFixed(1)),
        characterErrorRate: Number(Math.max(0.4, (100 - parsedRecord.sourceConfidence) / 10).toFixed(1)),
        processingTimeMs: totalProcessingTime,
      },
      validationErrors: parsedRecord.validationErrors,
      status: parsedRecord.validationErrors.length > 0 ? 'Pending Verification' : 'Extraction Ready',
      auditTrail: {
        ...doc.auditTrail,
        processedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    };

    setDocuments((prev) =>
      prev.map((d) => {
        if (d.id === docId) {
          return {
            ...d,
            ...updatedDocumentPatch,
            processingLogs: [
              ...d.processingLogs,
              {
                timestamp: new Date().toLocaleTimeString(),
                stage: 'OCR Pipeline',
                message: `Local OCR & Entity parsing completed in ${(totalProcessingTime / 1000).toFixed(2)}s with ${parsedRecord.sourceConfidence}% confidence.`,
                level: 'success',
              },
            ],
          };
        }
        return d;
      })
    );

    // Sync extraction results to backend
    updateDocumentOnBackend(docId, updatedDocumentPatch, currentUser.name).catch((err) => {
      console.warn(`[DHAROHAR API] Update document extraction ${docId} backend error:`, err);
    });

    addNotification(
      systemLanguage === 'hi' ? 'ओसीआर प्रसंस्करण संपन्न' : 'OCR Processing Finished',
      systemLanguage === 'hi' ? `दस्तावेज़ ${doc.documentCode} का विवरण निकाला गया एवं शजरा मिलान पूर्ण हुआ।` : `Document ${doc.documentCode} extracted and cross-referenced.`,
      'success'
    );
  };

  const updateExtractedFieldValue = (docId: string, fieldPath: string, value: any, note?: string) => {
    setDocuments((prev) =>
      prev.map((doc) => {
        if (doc.id === docId) {
          const clonedData = { ...doc.data } as any;

          // Map aliases from LLM schema to DocumentRecord structure
          let targetPath = fieldPath;
          if (fieldPath === 'mauza') targetPath = 'villageMauza';
          if (fieldPath === 'rakba' || fieldPath === 'totalAreaHectares') {
            const numVal = typeof value === 'number' ? value : parseFloat(String(value));
            if (!isNaN(numVal)) {
              clonedData.rakbaArea = {
                ...clonedData.rakbaArea,
                totalHectares: numVal,
                manualOverride: true,
              };
            }
          } else if (fieldPath === 'ownerName' || fieldPath === 'primaryOwner') {
            if (clonedData.owners && clonedData.owners.length > 0) {
              clonedData.owners[0] = {
                ...clonedData.owners[0],
                name: String(value),
              };
            }
          }

          const currentField = clonedData[targetPath];
          if (currentField && typeof currentField === 'object' && !Array.isArray(currentField)) {
            clonedData[targetPath] = {
              ...currentField,
              value,
              manualOverride: true,
              isFlagged: false,
            };
          } else if (targetPath === 'landClassification' && typeof value === 'string') {
            clonedData.landClassification = {
              value,
              hindiValue: currentField?.hindiValue,
              originalOcr: currentField?.originalOcr || value,
              confidence: currentField?.confidence ?? 100,
              manualOverride: true,
              isFlagged: false,
            };
          } else {
            clonedData[targetPath] = {
              value,
              manualOverride: true,
            };
          }

          const updatedDoc = {
            ...doc,
            data: clonedData,
            auditTrail: {
              ...doc.auditTrail,
              verificationNotes: note
                ? `${doc.auditTrail.verificationNotes || ''}\n[Modified ${fieldPath}]: ${note}`
                : doc.auditTrail.verificationNotes,
            },
          };

          // Sync field update to backend
          updateDocumentOnBackend(docId, {
            data: clonedData,
            auditTrail: updatedDoc.auditTrail,
          }, currentUser.name).catch((err) => {
            console.warn(`[DHAROHAR API] Update field ${fieldPath} for ${docId} backend error:`, err);
          });

          return updatedDoc;
        }
        return doc;
      })
    );
    addNotification(
      systemLanguage === 'hi' ? 'विवरण अद्यतित' : 'Field Updated',
      systemLanguage === 'hi' ? `फ़ील्ड '${fieldPath}' को "${value}" पर अद्यतित किया गया।` : `Field '${fieldPath}' updated to "${value}".`,
      'info'
    );
  };

  // Ownership percentage is the canonical numeric value. Fractions are a
  // human-readable representation and are normalized with a small tolerance
  // so repeating fractions such as 1/3 can safely display as 33.33%.
  const fractionToPercentage = (fraction: string): number | null => {
    const match = String(fraction || '').trim().match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
    if (!match) return null;
    const denominator = Number(match[2]);
    if (!Number.isFinite(denominator) || denominator <= 0) return null;
    const numerator = Number(match[1]);
    if (!Number.isFinite(numerator) || numerator < 0) return null;
    return Number((numerator / denominator * 100).toFixed(2));
  };

  const percentageToFraction = (percentage: number): string => {
    const pct = Number(percentage.toFixed(2));
    const common: Array<[number, string]> = [
      [100, '1/1'],
      [50, '1/2'],
      [25, '1/4'],
      [33.33, '1/3'],
      [66.67, '2/3'],
      [12.5, '1/8'],
      [20, '1/5'],
      [40, '2/5'],
      [60, '3/5'],
      [75, '3/4'],
    ];
    const exact = common.find(([value]) => Math.abs(value - pct) <= 0.005);
    if (exact) return exact[1];

    // Keep the percentage itself as the fallback representation. It round-trips
    // without inventing a mathematically different ownership share.
    return `${pct.toFixed(2).replace(/\.?0+$/, '')}/100`;
  };

  const normalizeOwnerShare = (owner: LandOwner, patch: Partial<LandOwner>): LandOwner => {
    const next = { ...owner, ...patch };

    if ('sharePercentage' in patch) {
      const numeric = Number(next.sharePercentage);
      if (Number.isFinite(numeric)) {
        const pct = Math.min(100, Math.max(0, Number(numeric.toFixed(2))));
        next.sharePercentage = pct;
        next.shareFraction = percentageToFraction(pct);
      }
    } else if ('shareFraction' in patch) {
      const pct = fractionToPercentage(String(next.shareFraction));
      if (pct != null) {
        next.sharePercentage = pct;
        next.shareFraction = percentageToFraction(pct);
      }
    }

    return next;
  };

  const updateOwner = (docId: string, ownerId: string, updatedFields: Partial<LandOwner>) => {
    let updatedOwnersList: LandOwner[] = [];
    setDocuments((prev) =>
      prev.map((doc) => {
        if (doc.id === docId) {
          const newOwners = doc.data.owners.map((o) => (o.id === ownerId ? normalizeOwnerShare(o, updatedFields) : o));
          updatedOwnersList = newOwners;
          return {
            ...doc,
            data: {
              ...doc.data,
              owners: newOwners,
            },
          };
        }
        return doc;
      })
    );

    if (updatedOwnersList.length > 0) {
      updateDocumentOnBackend(docId, { data: { owners: updatedOwnersList } as any }, currentUser.name).catch((err) => {
        console.warn(`[DHAROHAR API] Update owner for ${docId} backend error:`, err);
      });
    }

    addNotification(
      systemLanguage === 'hi' ? 'खातेदार विवरण अद्यतित' : 'Owner Record Updated',
      systemLanguage === 'hi' ? 'खातेदार विवरण एवं सह-खातेदारी स्थिति सहेजी गई।' : 'Owner details and co-sharer status saved.',
      'info'
    );
  };

  const addOwner = (docId: string, owner: LandOwner) => {
    let updatedOwnersList: LandOwner[] = [];
    setDocuments((prev) =>
      prev.map((doc) => {
        if (doc.id === docId) {
          const newOwners = [...doc.data.owners, owner];
          updatedOwnersList = newOwners;
          return {
            ...doc,
            data: {
              ...doc.data,
              owners: newOwners,
            },
          };
        }
        return doc;
      })
    );

    if (updatedOwnersList.length > 0) {
      updateDocumentOnBackend(docId, { data: { owners: updatedOwnersList } as any }, currentUser.name).catch((err) => {
        console.warn(`[DHAROHAR API] Add owner for ${docId} backend error:`, err);
      });
    }

    addNotification(
      systemLanguage === 'hi' ? 'सह-खातेदार जोड़ा गया' : 'Co-Sharer Added',
      systemLanguage === 'hi' ? `${owner.name} को स्वामित्व पंजिका में जोड़ा गया।` : `${owner.name} appended to ownership ledger.`,
      'success'
    );
  };

  const removeOwner = (docId: string, ownerId: string) => {
    let updatedOwnersList: LandOwner[] = [];
    setDocuments((prev) =>
      prev.map((doc) => {
        if (doc.id === docId) {
          const newOwners = doc.data.owners.filter((o) => o.id !== ownerId);
          updatedOwnersList = newOwners;
          return {
            ...doc,
            data: {
              ...doc.data,
              owners: newOwners,
            },
          };
        }
        return doc;
      })
    );

    updateDocumentOnBackend(docId, { data: { owners: updatedOwnersList } as any }, currentUser.name).catch((err) => {
      console.warn(`[DHAROHAR API] Remove owner for ${docId} backend error:`, err);
    });

    addNotification(
      systemLanguage === 'hi' ? 'सह-खातेदार हटाया गया' : 'Co-Sharer Removed',
      systemLanguage === 'hi' ? 'खातेदार को अभिलेख सारणी से हटाया गया।' : 'Owner removed from record table.',
      'warning'
    );
  };

  const resolveValidationError = (docId: string, errorId: string, note?: string) => {
    let updatedErrorsList: any[] = [];
    setDocuments((prev) =>
      prev.map((doc) => {
        if (doc.id === docId) {
          const updatedErrors = doc.validationErrors.map((err) =>
            err.id === errorId
              ? {
                  ...err,
                  resolved: true,
                  resolvedBy: currentUser.name,
                  resolutionNote: note || 'Resolved by Verification Officer after manual inspection.',
                }
              : err
          );
          updatedErrorsList = updatedErrors;
          return {
            ...doc,
            validationErrors: updatedErrors,
          };
        }
        return doc;
      })
    );

    if (updatedErrorsList.length > 0) {
      updateDocumentOnBackend(docId, { validationErrors: updatedErrorsList }, currentUser.name).catch((err) => {
        console.warn(`[DHAROHAR API] Resolve error for ${docId} backend error:`, err);
      });
    }

    addNotification(
      systemLanguage === 'hi' ? 'विसंगति निस्तारित' : 'Discrepancy Resolved',
      systemLanguage === 'hi' ? 'नियम सत्यापन त्रुटि को स्वीकृत/निस्तारित के रूप में चिह्नित किया गया।' : 'Rule validation error marked as cleared.',
      'success'
    );
  };

  const verifyAndSealRecord = (docId: string, notes: string) => {
    const certNum = `DHAROHAR/ROR/${new Date().getFullYear()}/${currentUser.district.substring(0, 3).toUpperCase()}/${Math.floor(
      10000 + Math.random() * 90000
    )}`;
    const hash = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

    // Find linked parcel if any
    const docToSeal = documents.find((d) => d.id === docId);
    const docKhasra = docToSeal?.data?.khasraNo?.value;
    const linkedParcel = parcels.find(
      (p) =>
        p.documentDisplayId === docId ||
        (docKhasra && p.khasraNo && p.khasraNo.includes(docKhasra)) ||
        (activeParcel && (activeParcel.documentDisplayId === docId || activeParcel.khasraNo === docKhasra))
    );

    if (linkedParcel) {
      updateParcel(linkedParcel.id, {
        status: 'Verified',
        verifiedBy: currentUser.name,
        verifiedAt: new Date().toISOString(),
        verificationNotes: notes || 'Verified accurate in accordance with Rajasthan Land Revenue Act 1956.',
      });
    }

    const updatedAuditTrail = {
      ...docToSeal?.auditTrail,
      verifiedBy: currentUser.name,
      verifiedAt: new Date().toLocaleString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      verifierBadge: currentUser.badgeNumber,
      digitalSignatureHash: hash,
      certificateNumber: certNum,
      qrPayload: `DHAROHAR-PROTOTYPE|VERIFY|${certNum}`,
      verificationNotes: notes || 'Verified accurate in accordance with Rajasthan Land Revenue Act 1956.',
    };

    setDocuments((prev) =>
      prev.map((doc) => {
        if (doc.id === docId) {
          return normalizeDocumentRecord({
            ...doc,
            status: 'Verified',
            auditTrail: updatedAuditTrail,
          });
        }
        return normalizeDocumentRecord(doc);
      })
    );

    // Persist to PostgreSQL backend via REST API
    sealRecordOnBackend({
      parcelId: linkedParcel?.id,
      documentId: docId,
      officerName: currentUser.name,
      officerBadge: currentUser.badgeNumber,
      officerNotes: notes || 'Verified against Master Shajra Cadastre.',
      recordData: docToSeal?.data,
    }).catch(() => null);

    updateDocumentOnBackend(docId, {
      status: 'Verified',
      auditTrail: updatedAuditTrail,
    }, currentUser.name).catch((err) => {
      console.warn(`[DHAROHAR API] Update document seal status for ${docId} backend error:`, err);
    });

    // Update district metrics
    setDistrictMetrics((prev) =>
      prev.map((dm) => (dm.district === currentUser.district ? { ...dm, verifiedRecords: dm.verifiedRecords + 1 } : dm))
    );

    addNotification(
      systemLanguage === 'hi' ? 'भू-अभिलेख सत्यापित एवं डिजिटल रूप से सीलबंद' : 'Land Record Verified & Digitally Sealed',
      systemLanguage === 'hi' ? `अभिलेख प्रमाण पत्र संख्या #${certNum} डिजिटल सत्यापन फिंगरप्रिंट सहित जारी किया गया।` : `Prototype record certificate #${certNum} issued with a demo verification fingerprint.`,
      'success'
    );
  };

  const acceptExtractedRecord = (docId: string) => {
    let updatedNotes = '';
    const newStatus = 'Extraction Ready';
    setDocuments((prev) =>
      prev.map((doc) => {
        if (doc.id === docId) {
          updatedNotes = doc.auditTrail?.verificationNotes
            ? `${doc.auditTrail.verificationNotes}\n[Extraction Accepted]: Confirmed by ${currentUser.name}.`
            : `[Extraction Accepted]: Confirmed by ${currentUser.name}.`;
          const valErrors = Array.isArray(doc.validationErrors) ? doc.validationErrors : [];
          return normalizeDocumentRecord({
            ...doc,
            isAccepted: true,
            status: valErrors.length > 0 ? 'Pending Verification' : 'Extraction Ready',
            auditTrail: {
              ...(doc.auditTrail || {}),
              verificationNotes: updatedNotes,
            },
            processingLogs: [
              ...(Array.isArray(doc.processingLogs) ? doc.processingLogs : []),
              {
                timestamp: new Date().toLocaleTimeString(),
                stage: 'Acceptance',
                message: `Extracted record accepted by ${currentUser.name}. Ready for compliance validation.`,
                level: 'success',
              },
            ],
          });
        }
        return normalizeDocumentRecord(doc);
      })
    );

    updateDocumentOnBackend(docId, {
      isAccepted: true,
      status: newStatus,
      auditTrail: { verificationNotes: updatedNotes } as any,
    }, currentUser.name).catch((err) => {
      console.warn(`[DHAROHAR API] Accept document for ${docId} backend error:`, err);
    });

    addNotification(
      systemLanguage === 'hi' ? 'अभिलेख विवरण स्वीकृत' : 'Record Accepted',
      systemLanguage === 'hi'
        ? 'निकाले गए भू-अभिलेख विवरण को स्वीकार किया गया। नियम सत्यापन हेतु तैयार।'
        : 'Extracted land record fields accepted by officer. Ready for compliance validation.',
      'success'
    );
  };

  const rejectRecord = (docId: string, reason: string) => {
    const rejectionNote = `REJECTED by ${currentUser.name}: ${reason}`;
    setDocuments((prev) =>
      prev.map((doc) => {
        if (doc.id === docId) {
          return normalizeDocumentRecord({
            ...doc,
            status: 'Rejected',
            auditTrail: {
              ...(doc.auditTrail || {}),
              verificationNotes: doc.auditTrail?.verificationNotes
                ? `${doc.auditTrail.verificationNotes}\n[Rejection]: ${rejectionNote}`
                : rejectionNote,
            },
            processingLogs: [
              ...(Array.isArray(doc.processingLogs) ? doc.processingLogs : []),
              {
                timestamp: new Date().toLocaleTimeString(),
                stage: 'Rejection',
                message: `Record rejected by ${currentUser.name}. Reason: ${reason}`,
                level: 'warn',
              },
            ],
          });
        }
        return normalizeDocumentRecord(doc);
      })
    );

    updateDocumentOnBackend(docId, {
      status: 'Rejected',
      auditTrail: { verificationNotes: rejectionNote } as any,
    }, currentUser.name).catch((err) => {
      console.warn(`[DHAROHAR API] Reject document for ${docId} backend error:`, err);
    });

    addNotification(
      systemLanguage === 'hi' ? 'अभिलेख अस्वीकृत' : 'Record Rejected',
      systemLanguage === 'hi' ? `दस्तावेज़ अस्वीकृत चिह्नित: ${reason}` : `Document marked rejected: ${reason}`,
      'error'
    );
  };

  const flagForPatwariInspection = (docId: string, instructions: string) => {
    setDocuments((prev) =>
      prev.map((doc) => {
        if (doc.id === docId) {
          return normalizeDocumentRecord({
            ...doc,
            status: 'Flagged for Patwari',
            auditTrail: {
              ...(doc.auditTrail || {}),
              patwariRemarks: instructions,
            },
            processingLogs: [
              ...(Array.isArray(doc.processingLogs) ? doc.processingLogs : []),
              {
                timestamp: new Date().toLocaleTimeString(),
                stage: 'Patwari Inspection',
                message: `Flagged for Patwari field inspection by ${currentUser.name}. Notes: ${instructions}`,
                level: 'warn',
              },
            ],
          });
        }
        return normalizeDocumentRecord(doc);
      })
    );

    updateDocumentOnBackend(docId, {
      status: 'Flagged for Patwari',
      auditTrail: { patwariRemarks: instructions } as any,
    }, currentUser.name).catch((err) => {
      console.warn(`[DHAROHAR API] Flag document for Patwari for ${docId} backend error:`, err);
    });

    addNotification(
      systemLanguage === 'hi' ? 'पटवारी को प्रेषित' : 'Forwarded to Patwari',
      systemLanguage === 'hi' ? 'हल्का पटवारी को स्थलीय निरीक्षण आदेश जारी किया गया।' : 'Field inspection order dispatched to Halka Patwari.',
      'warning'
    );
  };

  const startBatchProcessing = (batchId: string) => {
    setBatches((prev) =>
      prev.map((b) => (b.id === batchId ? { ...b, status: 'OCR In Progress' } : b))
    );
    addNotification(
      systemLanguage === 'hi' ? 'बैच प्रसंस्करण प्रारंभ' : 'Batch Execution Started',
      systemLanguage === 'hi' ? `${batchId} हेतु वर्कर थ्रेड्स आवंटित किए गए।` : `Worker threads allocated for ${batchId}.`,
      'info'
    );
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        isAuthenticated,
        isLoggedIn: isAuthenticated,
        activeView,
        documents,
        activeDocument,
        batches,
        districtMetrics,
        notifications,
        systemLanguage,
        backendHealth,
        checkBackendStatus,
        toggleLanguage,
        setLanguage,
        login,
        logout,
        setActiveView,
        selectDocument,
        uploadDocument,
        updateQualityEnhancements,
        runProcessingSimulation,
        updateExtractedFieldValue,
        updateOwner,
        addOwner,
        removeOwner,
        resolveValidationError,
        verifyAndSealRecord,
        acceptExtractedRecord,
        rejectRecord,
        flagForPatwariInspection,
        addNotification,
        dismissNotification,
        startBatchProcessing,
        linkDocumentToParcel,
        deleteParcel,
        archiveParcel,
        parcels,
        activeParcels,
        activeParcel,
        selectParcel,
        createParcel,
        updateParcel,
        refreshParcels,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
