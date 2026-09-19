/* ============================================================
   VICTORY FLUENT FORUM — VFF TEACHING STUDIO JS
   File: tools/online-whiteboard/whiteboard.js
   Version: 3.2.0 (Premium Teacher UX, Robust ESC Presentation, Crisp Subject Toolkits)
   ============================================================ */

(function () {
  'use strict';

  // Master State Container
  const state = {
    // Current Active Tool & Subject Mode
    currentTool: 'pen', // pen, highlighter, eraser, line, arrow, rectangle, circle, triangle, text, ruler, pan
    subjectMode: 'general', // general, math, science, english, speech
    strokeColor: '#2563eb',
    strokeWidth: 4,
    fontSize: 22,
    fontFamily: 'Inter, -apple-system, sans-serif',
    fillShape: false,
    gridPattern: 'dots', // dots, math, graph, coord, numline, lines, table, speech, blank

    // Zoom & Pan State
    zoomLevel: 1.0,
    panX: 0,
    panY: 0,
    isPanning: false,
    panStartX: 0,
    panStartY: 0,

    // Drawing Interaction State
    isDrawing: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    currentPath: [],

    // Undo / Redo History Stack (Per-page history)
    historyStack: [],
    historyIndex: -1,
    maxHistory: 30,

    // Inline Direct Text Editing State
    isEditingText: false,
    activeTextPos: null,

    // Teaching Material State (PDF, Image, Text, PPTX-ready)
    materialType: 'blank', // blank, pdf, image, text, ppt
    materialName: 'Blank Whiteboard',
    pdfDoc: null,
    pdfPageNum: 1,
    pdfTotalPages: 0,
    pdfLoaded: false,
    pageHistories: {}, // pageNum -> { stack: ImageData[], index: number }

    // Presentation Mode & Collapsible UI State
    isPresentationMode: false,
    isToolbarCollapsed: false,
    isPresToolPanelOpen: false,
    isSubjectDrawerOpen: false,

    // Phase 2: Lesson Flow State (1 to 8)
    lessonStage: 1,

    // Phase 2: Lesson Blocks State (Movable, Editable, Deletable Overlay Objects)
    lessonBlocks: [],
    blockHistories: {},

    // Phase 2: Teaching Assets Drawer & Quick Actions State
    isAssetsDrawerOpen: false,
    activeAssetTab: 'annotations',
    activeAnnotationCategory: 'all',
    isQuickActionsOpen: false,
    isPresQuickActionsOpen: false,
    isPresBgMenuOpen: false,

    // Phase 2: Spotlight & Laser Presentation Mode State
    isSpotlightActive: false,
    isLaserActive: false,
    laserPoints: [],

    // Phase 2.5: Classroom Surfaces, PDF Underlay Layer, Stylus Only & Shapes State
    canvasSurface: 'white', // white, chalkboard, blackboard, cream
    stylusOnlyMode: false,
    pdfChalkboardMode: false,
    isSpaceDown: false,
    previousToolBeforeSpace: null,

    // Phase 3: Dedicated Image Layer State (Safe Eraser Architecture)
    loadedImages: [],

    // Phase 3: Teaching Studio Local Recording Engine State
    isRecording: false,
    mediaRecorder: null,
    recordedChunks: [],
    recordedBlob: null,
    recordedUrl: null,
    recordingStartTime: 0,
    recordingDurationSec: 0,
    recordingTimerInterval: null,
    recordingRafId: null,
    recordingCompositorCanvas: null,
    recordingCompositorCtx: null,
    recordingAudioStream: null,
    recordingHasAudio: false,
    recordingMimeType: '',
    isPointerOnCanvas: false,
    lastPointerX: 0,
    lastPointerY: 0,
    // Phase 3.1 / P1: Compositor 30 FPS Throttling & Dirty-Flag Idle Bypass State
    recordingIsDirty: true,
    lastRecordingFrameTime: 0,
    lastRecordingHeartbeatTime: 0,

    // Phase 2.8: Teaching Object Selection Engine & Math Toolkit State
    selectedObject: null, // { type: 'image'|'pdf'|'block', id, ref, bounds: {x, y, w, h}, locked: false }
    selectionDragMode: null, // 'move' | 'handle-nw' | 'handle-n' | ...
    dragInitialState: null, // { clientX, clientY, bounds, aspect }
    pdfMaterialTransform: null, // { x, y, width, height, locked: false }
    currentPdfPageCanvas: null,
    isShapesPopoverOpen: false,
    isMathPopoverOpen: false
  };

  /* ============================================================
     TEACHING MATERIAL ABSTRACTION (GENOME-READY)
     ============================================================ */
  const TeachingMaterial = {
    types: ['blank', 'pdf', 'image', 'text', 'ppt'],
    current: {
      type: 'blank',
      name: 'Blank Whiteboard',
      totalPages: 1,
      currentPage: 1,
      metadata: {}
    },
    setMaterial(type, name, totalPages, metadata = {}) {
      this.current = { type, name, totalPages, currentPage: 1, metadata };
      state.materialType = type;
      state.materialName = name;
      updateDocumentHeaderInfo();
      TeachingSession.setMaterial(type, metadata);
    }
  };

  /* ============================================================
     PROJECT GENOME — TEACHING INTELLIGENCE BRIDGE (VFF GENOME CORE)
     Single Central VFF AI Architecture — No Secondary AI
     The Whiteboard / Teaching Studio is an evidence-producing
     client layer inside the master VFF Project Genome architecture.
     ============================================================ */

  // 1. CONSENT STATE & LOCAL ENGINE (PHASE 2.7 IMPLEMENTATION)
  // Architecture: CONSENT -> ELIGIBILITY -> PRIVACY FILTERING -> CURATION -> PROJECT GENOME -> ONE CENTRAL VFF AI
  const CURRENT_CONSENT_VERSION = '2.7.0';
  const CURRENT_POLICY_VERSION = '2026.1';
  const CONSENT_STORAGE_KEY = 'vff_teaching_consent_v2';

  const CONSENT_STATES = {
    UNKNOWN: 'unknown',
    DENIED: 'denied',
    GRANTED: 'granted',
    REVOKED: 'revoked'
  };

  const ConsentState = {
    // Preserve existing conceptual tiers for full backward compatibility
    LEVELS: {
      NONE: 'none',
      SESSION_ONLY: 'session_only',
      SHARE_STRUCTURED_SIGNALS: 'share_structured_signals',
      SHARE_LESSON_CONTENT: 'share_lesson_content'
    },
    STATES: CONSENT_STATES,
    CURRENT_CONSENT_VERSION,
    CURRENT_POLICY_VERSION,
    STORAGE_KEY: CONSENT_STORAGE_KEY,

    status: CONSENT_STATES.UNKNOWN,
    consented: false, // Default is strictly FALSE. No automatic transmission occurs.
    level: 'none',
    consentedAt: null,
    updatedAt: null,
    categories: {
      structuralSignals: false,
      teachingContent: false, // Quarantined local-only in V1
      recordings: false       // Quarantined local-only in V1
    },

    init() {
      try {
        const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
        if (raw) {
          const record = JSON.parse(raw);
          if (record && typeof record === 'object') {
            if (record.consentVersion === CURRENT_CONSENT_VERSION && record.policyVersion === CURRENT_POLICY_VERSION) {
              const stateVal = record.consentState;
              if (stateVal === CONSENT_STATES.GRANTED) {
                this.status = CONSENT_STATES.GRANTED;
                this.consented = true;
                this.level = this.LEVELS.SHARE_STRUCTURED_SIGNALS;
                this.categories.structuralSignals = true;
                this.consentedAt = record.consentedAt || null;
                this.updatedAt = record.updatedAt || null;
              } else if (stateVal === CONSENT_STATES.DENIED) {
                this.status = CONSENT_STATES.DENIED;
                this.consented = false;
                this.level = this.LEVELS.NONE;
                this.categories.structuralSignals = false;
                this.updatedAt = record.updatedAt || null;
              } else if (stateVal === CONSENT_STATES.REVOKED) {
                this.status = CONSENT_STATES.REVOKED;
                this.consented = false;
                this.level = this.LEVELS.NONE;
                this.categories.structuralSignals = false;
                this.updatedAt = record.updatedAt || null;
              } else {
                this.status = CONSENT_STATES.UNKNOWN;
                this.consented = false;
                this.level = this.LEVELS.NONE;
              }
            } else {
              // Material version change: return to unknown to allow re-consent
              this.status = CONSENT_STATES.UNKNOWN;
              this.consented = false;
              this.level = this.LEVELS.NONE;
            }
          }
        }
      } catch (e) {
        console.warn('VFF ConsentState init warning:', e);
        this.status = CONSENT_STATES.UNKNOWN;
        this.consented = false;
        this.level = this.LEVELS.NONE;
      }

      if (typeof TeachingSession !== 'undefined' && TeachingSession.updateConsentState) {
        TeachingSession.updateConsentState(this.getSummary());
      }
      return this.status;
    },

    saveToStorage() {
      try {
        const record = {
          consentState: this.status,
          consentVersion: CURRENT_CONSENT_VERSION,
          policyVersion: CURRENT_POLICY_VERSION,
          consentedAt: this.consentedAt,
          updatedAt: this.updatedAt || Date.now(),
          categories: {
            structuralSignals: this.status === CONSENT_STATES.GRANTED,
            teachingContent: false,
            recordings: false
          },
          metadata: {
            storageOrigin: 'local_storage',
            clientRuntime: 'vff_teaching_studio_web'
          }
        };
        localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record));
      } catch (e) {
        console.warn('VFF ConsentState: Could not save to localStorage:', e);
      }
    },

    getLocalRecord() {
      try {
        const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    },

    isConsentCurrent() {
      const record = this.getLocalRecord();
      if (!record) return false;
      return record.consentVersion === CURRENT_CONSENT_VERSION && record.policyVersion === CURRENT_POLICY_VERSION;
    },

    setConsent(status, level = 'none') {
      const isGranted = (status === true || status === CONSENT_STATES.GRANTED || status === 'granted');
      const isDenied = (status === false || status === CONSENT_STATES.DENIED || status === 'denied');
      const isRevoked = (status === CONSENT_STATES.REVOKED || status === 'revoked');

      if (isGranted) {
        this.status = CONSENT_STATES.GRANTED;
        this.consented = true;
        this.level = (level && level !== 'none') ? level : this.LEVELS.SHARE_STRUCTURED_SIGNALS;
        this.consentedAt = this.consentedAt || Date.now();
        this.updatedAt = Date.now();
        this.categories.structuralSignals = true;
      } else if (isDenied) {
        this.status = CONSENT_STATES.DENIED;
        this.consented = false;
        this.level = this.LEVELS.NONE;
        this.categories.structuralSignals = false;
        this.updatedAt = Date.now();
      } else if (isRevoked) {
        this.status = CONSENT_STATES.REVOKED;
        this.consented = false;
        this.level = this.LEVELS.NONE;
        this.categories.structuralSignals = false;
        this.updatedAt = Date.now();
      } else {
        this.status = CONSENT_STATES.UNKNOWN;
        this.consented = false;
        this.level = this.LEVELS.NONE;
        this.categories.structuralSignals = false;
        this.updatedAt = Date.now();
      }

      this.saveToStorage();

      if (typeof TeachingSession !== 'undefined' && TeachingSession.updateConsentState) {
        TeachingSession.updateConsentState(this.getSummary());
      }
      if (typeof updatePrivacyUI === 'function') {
        updatePrivacyUI();
      }
      return this.status;
    },

    revokeConsent() {
      return this.setConsent(CONSENT_STATES.REVOKED);
    },

    resetConsent() {
      try {
        localStorage.removeItem(CONSENT_STORAGE_KEY);
      } catch (e) {}
      this.status = CONSENT_STATES.UNKNOWN;
      this.consented = false;
      this.level = this.LEVELS.NONE;
      this.consentedAt = null;
      this.updatedAt = null;
      this.categories.structuralSignals = false;

      if (typeof TeachingSession !== 'undefined' && TeachingSession.updateConsentState) {
        TeachingSession.updateConsentState(this.getSummary());
      }
      if (typeof updatePrivacyUI === 'function') {
        updatePrivacyUI();
      }
      return this.status;
    },

    canShareStructured() {
      return Boolean(
        this.consented &&
        this.status === CONSENT_STATES.GRANTED &&
        (this.level === this.LEVELS.SHARE_STRUCTURED_SIGNALS || this.level === this.LEVELS.SHARE_LESSON_CONTENT)
      );
    },

    canShareContent() {
      // Always false in V1: Raw lesson content sharing requires explicit future legal consent and contributor upload
      return false;
    },

    getSummary() {
      return {
        status: this.status,
        consented: this.consented,
        level: this.level,
        consentVersion: CURRENT_CONSENT_VERSION,
        policyVersion: CURRENT_POLICY_VERSION,
        timestamp: this.consentedAt,
        updatedAt: this.updatedAt,
        categories: { ...this.categories },
        privacyBoundary: 'strict_local_processing'
      };
    }
  };

  // 2. PEDAGOGICAL SIGNAL (SAFE STRUCTURAL EVIDENCE VS RAW CONTENT)
  const PedagogicalSignal = {
    MAX_BUFFER: 300,
    signals: [],

    // Strict structural allowlist: filters out all handwritten stroke paths,
    // typed lesson bodies, uploaded PDF/image binaries, student data, and PII.
    SAFE_META_KEYS: [
      'tool', 'stage', 'phase', 'sequenceIndex', 'category', 'templateId',
      'stampId', 'pageCount', 'page', 'revealed', 'durationSeconds',
      'action', 'subject', 'blockType', 'count', 'format', 'pattern',
      'zoom', 'active', 'source', 'direction', 'component', 'artifactType'
    ],

    sanitize(metadata = {}) {
      if (!metadata || typeof metadata !== 'object') return {};
      const clean = {};
      for (const key of this.SAFE_META_KEYS) {
        if (metadata[key] !== undefined && metadata[key] !== null) {
          if (typeof metadata[key] === 'string') {
            clean[key] = metadata[key].slice(0, 100);
          } else if (typeof metadata[key] === 'number' || typeof metadata[key] === 'boolean') {
            clean[key] = metadata[key];
          }
        }
      }
      return clean;
    },

    record(signalType, metadata = {}, category = 'pedagogical_structure') {
      const sanitizedMeta = this.sanitize(metadata);
      const signal = {
        signalId: 'sig_' + Math.random().toString(36).substring(2, 9),
        type: signalType,
        category: category,
        timestamp: Date.now(),
        subject: (state && state.subjectMode) || 'general',
        lessonPhase: (state && state.lessonStage && typeof TeachingSession !== 'undefined' && TeachingSession.getPhaseName)
          ? TeachingSession.getPhaseName(state.lessonStage)
          : 'intro',
        meta: sanitizedMeta
      };

      this.signals.push(signal);
      if (this.signals.length > this.MAX_BUFFER) this.signals.shift();

      if (typeof TeachingSession !== 'undefined' && TeachingSession.recordSignal) {
        TeachingSession.recordSignal(signal);
      }
      return signal;
    },

    getSignals(filterType = null) {
      if (!filterType) return [...this.signals];
      return this.signals.filter(s => s.type === filterType || s.category === filterType);
    },

    clear() {
      this.signals = [];
    }
  };

  // 3. TEACHING SESSION MODEL (GENOME-COMPATIBLE EVIDENCE COLLECTOR)
  const TeachingSession = {
    sessionId: 'vff_sess_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now(),
    startTime: Date.now(),
    subject: 'general',
    materialType: 'blank',
    materialMetadata: { pageCount: 1 },
    pageSequence: [1],
    lessonFlow: [],
    pedagogicalSignals: [],
    assetsUsed: [],
    toolsUsed: {
      pen: 0, highlighter: 0, eraser: 0, shapes: 0,
      text: 0, ruler: 0, math: 0, science: 0, english: 0, speech: 0
    },
    blocksUsed: {
      note: 0, reveal: 0, prompt: 0, table: 0,
      quote: 0, definition: 0, formula: 0
    },
    presentationActions: [],
    exportActions: [],
    actionsCount: 0,
    sessionDuration: 0,
    consentState: ConsentState.getSummary(),

    PHASE_NAMES: [
      'intro', 'explain', 'example', 'ask',
      'think', 'reveal', 'practice', 'recap'
    ],

    getPhaseName(stageNum) {
      const idx = Math.max(1, Math.min(8, stageNum)) - 1;
      return this.PHASE_NAMES[idx] || 'intro';
    },

    setMaterial(type, metadata = {}) {
      this.materialType = type;
      this.materialMetadata = {
        pageCount: metadata.pageCount || 1,
        timestamp: Date.now()
      };
      this.logAction('material_loaded', { type, pageCount: metadata.pageCount || 1 });
      PedagogicalSignal.record('material_loaded', { type, pageCount: metadata.pageCount || 1 }, 'material_metadata');
    },

    setSubject(subjectMode) {
      this.subject = subjectMode;
      this.logAction('subject_mode_change', { mode: subjectMode });
      PedagogicalSignal.record('subject_mode_change', { subject: subjectMode }, 'pedagogical_structure');
    },

    recordLessonPhase(stageNum, phaseName) {
      const normalizedPhase = phaseName
        ? phaseName.toLowerCase().replace(/^[0-9]+\.\s*/, '')
        : this.getPhaseName(stageNum);
      const phaseEntry = {
        stageIndex: stageNum,
        phase: normalizedPhase,
        timestamp: Date.now(),
        sequenceIndex: this.lessonFlow.length + 1
      };
      this.lessonFlow.push(phaseEntry);
      PedagogicalSignal.record('lesson_phase', {
        stage: stageNum,
        phase: normalizedPhase,
        sequenceIndex: phaseEntry.sequenceIndex
      }, 'pedagogical_structure');
    },

    recordAssetUsage(category, type, templateId = null) {
      const entry = {
        category,
        type: type || 'standard',
        templateId: templateId || null,
        subject: this.subject,
        timestamp: Date.now()
      };
      this.assetsUsed.push(entry);
      PedagogicalSignal.record('asset_used', {
        category,
        assetType: type,
        templateId: templateId,
        subject: this.subject
      }, 'interactive_element');
    },

    recordBlockCreated(blockType) {
      if (this.blocksUsed[blockType] !== undefined) {
        this.blocksUsed[blockType]++;
      } else {
        this.blocksUsed[blockType] = 1;
      }
      this.recordAssetUsage('block', blockType);
      PedagogicalSignal.record('block_created', { blockType }, 'interactive_element');
    },

    recordPresentationAction(action, details = {}) {
      const entry = {
        action,
        timestamp: Date.now(),
        details: PedagogicalSignal.sanitize(details)
      };
      this.presentationActions.push(entry);
      PedagogicalSignal.record('presentation_event', { action, ...details }, 'pedagogical_structure');
    },

    recordExportAction(format, details = {}) {
      const entry = {
        format,
        timestamp: Date.now(),
        details: PedagogicalSignal.sanitize(details)
      };
      this.exportActions.push(entry);
      PedagogicalSignal.record('export_event', { format, ...details }, 'pedagogical_structure');
    },

    recordSignal(signal) {
      this.pedagogicalSignals.push(signal);
      if (this.pedagogicalSignals.length > 300) this.pedagogicalSignals.shift();
    },

    updateConsentState(summary) {
      this.consentState = summary;
    },

    logAction(actionType, details = {}) {
      this.actionsCount++;
      if (details.tool && this.toolsUsed[details.tool] !== undefined) {
        this.toolsUsed[details.tool]++;
      }
      if (details.page && !this.pageSequence.includes(details.page)) {
        this.pageSequence.push(details.page);
      }
      this.sessionDuration = Math.round((Date.now() - this.startTime) / 1000);

      // Map structural events into Genome evidence stores
      if (actionType === 'subject_mode_change' && details.mode) {
        this.subject = details.mode;
      } else if (actionType === 'lesson_stage_changed' && details.stage) {
        this.recordLessonPhase(details.stage);
      } else if (actionType === 'sticker_stamped' && details.stampId) {
        this.recordAssetUsage('sticker', details.stampId);
      } else if (actionType === 'infographic_inserted' && details.type) {
        this.recordAssetUsage('infographic', details.type);
      } else if (actionType === 'template_loaded' && details.templateId) {
        this.recordAssetUsage('template', details.templateId, details.templateId);
      } else if (actionType === 'lesson_block_created' && details.type) {
        this.recordBlockCreated(details.type);
      } else if (actionType === 'presentation_mode_enter' || actionType === 'presentation_mode_exit') {
        this.recordPresentationAction(actionType);
      } else if (actionType === 'spotlight_used' || actionType === 'laser_used') {
        this.recordPresentationAction(actionType, details);
      } else if (actionType === 'whiteboard_export_png') {
        this.recordExportAction('png');
      } else if (actionType === 'whiteboard_print') {
        this.recordExportAction('pdf_print');
      }

      trackEvent(actionType, details);
    },

    exportGenomeSummary() {
      return {
        sessionId: this.sessionId,
        genomeBridgeVersion: '1.0',
        architecture: 'VFF Project Genome',
        durationSeconds: this.sessionDuration,
        subject: this.subject,
        materialType: this.materialType,
        materialPageCount: this.materialMetadata.pageCount || 1,
        totalActions: this.actionsCount,
        uniquePagesVisited: this.pageSequence.length,
        lessonFlowSummary: this.lessonFlow.map(f => ({ phase: f.phase, stage: f.stageIndex })),
        toolDistribution: { ...this.toolsUsed },
        blocksSummary: { ...this.blocksUsed },
        assetsCount: this.assetsUsed.length,
        presentationActionsCount: this.presentationActions.length,
        exportActionsCount: this.exportActions.length,
        consentState: { ...this.consentState }
      };
    }
  };

  // 4. FUTURE ARTIFACT & AI GENERATION CONTRACT (CENTRAL GENOME CONSUMPTION HOOK)
  // Architecture Ready for Central VFF Project Genome (No Second AI, No External APIs)
  const TeachingArtifact = {
    // 10 Standard VFF Project Genome Pedagogical Artifact Types
    TYPES: [
      'presentation',
      'worksheet',
      'assessment',
      'quiz',
      'activity',
      'teacherNotes',
      'whiteboardLesson',
      'answerKey',
      'homework',
      'recap'
    ],

    validate(artifact) {
      if (!artifact || typeof artifact !== 'object') return false;
      if (!artifact.type || !this.TYPES.includes(artifact.type)) return false;
      if (!artifact.title || typeof artifact.title !== 'string') return false;
      return true;
    },

    // Future ingestion hook: allows Teaching Studio to consume a generated VFF Genome lesson
    ingest(artifact) {
      if (!this.validate(artifact)) {
        return { success: false, reason: 'invalid_artifact_schema' };
      }

      // Record structural arrival into Genome bridge
      PedagogicalSignal.record('artifact_ingested', {
        artifactType: artifact.type,
        subject: artifact.subject || (state && state.subjectMode) || 'general',
        count: (artifact.blocks && artifact.blocks.length) || 0
      }, 'pedagogical_structure');

      return {
        success: true,
        type: artifact.type,
        title: artifact.title,
        ingestedAt: Date.now()
      };
    }
  };

  // 5. GENOME EXPORT ADAPTER (CENTRAL ADAPTER WITH STRICT CONSENT GATE)
  const GenomeExportAdapter = {
    canExport() {
      // Must have explicit teacher consent (ConsentState.canShareStructured() === true)
      return ConsentState.canShareStructured();
    },

    validateConsent(requiredLevel = 'share_structured_signals') {
      if (!ConsentState.consented) {
        return { valid: false, reason: 'consent_not_granted' };
      }
      if (requiredLevel === 'share_lesson_content' && !ConsentState.canShareContent()) {
        return { valid: false, reason: 'lesson_content_sharing_not_consented' };
      }
      return { valid: true };
    },

    collectStructuredSignals() {
      return PedagogicalSignal.getSignals();
    },

    buildGenomeSession() {
      return TeachingSession.exportGenomeSummary();
    },

    exportStructuredGenomeData() {
      // HARD CONSENT GATE: Refuses export when consent is false
      if (!this.canExport()) {
        return {
          status: 'consent_required',
          data: null,
          message: 'Privacy Protection Active: ConsentState is false by default. No data transmitted.'
        };
      }

      return {
        status: 'success',
        sourceArchitecture: 'VFF Project Genome',
        schemaVersion: '1.0',
        exportedAt: Date.now(),
        session: this.buildGenomeSession(),
        signals: this.collectStructuredSignals(),
        curriculumEvidence: {
          subject: TeachingSession.subject,
          materialType: TeachingSession.materialType,
          phasesTraversed: TeachingSession.lessonFlow.map(f => f.phase),
          assetsSummary: TeachingSession.assetsUsed.map(a => ({ category: a.category, type: a.type })),
          toolsSummary: { ...TeachingSession.toolsUsed },
          blocksSummary: { ...TeachingSession.blocksUsed }
        }
      };
    }
  };

  // DOM Elements References
  let canvas, ctx, canvasContainer, directText;
  // Phase 1 P0: High-Performance Canvas Infrastructure (Transient Preview, Cached Geometry & Batching)
  let previewCanvas, previewCtx;
  let cachedCanvasRect = null;
  let drawRafId = null;
  let pendingPoints = [];
  let strokePoints = [];
  let lastRenderedIndex = 0;
  let undoBtn, redoBtn, zoomValLabel, pageNumLabel, pageNavGroup;
  let firstPdfBtn, prevPdfBtn, nextPdfBtn, lastPdfBtn;
  let presentBtn, exitPresentBtn, toggleToolbarBtn, toolbarEl;
  let presToolsBtn, presToolPanel, presHideToolsBtn;
  let subjectSelect, subjectDrawer, docTitleLabel, headerPageStatus;
  let emptyStateEl;
  // Phase 2 Element References
  let assetsDrawer, blocksLayer, spotlightCanvas, spotlightCtx, laserCanvas, laserCtx;
  let quickActionsMenu, lessonFlowBar;
  let presHeader, presDocTitle, presPdfNav, presPdfPrev, presPdfNext, presPdfPageNum;
  let presHeaderToolsBtn, presHeaderAssetsBtn, presExitBtn;
  let presQuickActionsWrap, presQuickActionsBtn, presQuickActionsMenu;
  let presPdfUploadBtn, presImgUploadBtn;
  let presBgWrap, presBgBtn, presBgMenu;
  let headerAssetsBtn, toolbarAssetsBtn, closeAssetsDrawerBtn;
  // Phase 2.5 Element References
  let pdfCanvas, pdfCtx;
  let surfaceSelect, lineStyleBtn, stylusOnlyBtn, pdfChalkboardBtn;
  let presPdfChalkboardBtn, presStylusBtn;

  // Phase 3 Element References (Dedicated Image Layer & Recording System)
  let imageCanvas, imageCtx;
  let wbRecordBtn, wbRecordBtnText, wbRecordingIndicator, wbRecordingTimer, wbRecordMicCheckbox, wbMicIcon;
  let wbPresRecordBtn, wbPresRecordBtnText, wbPresRecordingIndicator, wbPresRecordingTimer;
  let wbRecordingModal, wbRecVideoPlayer, wbRecDurationLabel, wbRecFormatLabel, wbRecAudioLabel;
  let wbRecDeleteBtn, wbRecPlayBtn, wbRecDownloadBtn, wbRecCloseBtn;

  // Phase 2.8 Element References (Teaching Object Selection & Math Toolkit)
  let selectionOverlay, selectionBox, selectionToolbar, selTypeBadge, selTypeText;
  let selDuplicateBtn, selLockBtn, selLockIcon, selForwardBtn, selBackBtn, selDeleteBtn;
  let shapesBtn, mathBtn, shapesPopover, mathPopover, emptyReopenBtn, emptyDismissBtn;

  // Initialize Engine when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    canvas = document.getElementById('whiteboardCanvas');
    if (!canvas) return;

    ctx = canvas.getContext('2d', { willReadFrequently: true });
    canvasContainer = document.getElementById('wbCanvasContainer');
    directText = document.getElementById('wbDirectText');
    undoBtn = document.getElementById('wbUndoBtn');
    redoBtn = document.getElementById('wbRedoBtn');
    zoomValLabel = document.getElementById('wbZoomVal');
    pageNumLabel = document.getElementById('wbPdfPageNum');
    pageNavGroup = document.getElementById('wbPdfNavGroup');
    firstPdfBtn = document.getElementById('wbPdfFirst');
    prevPdfBtn = document.getElementById('wbPdfPrev');
    nextPdfBtn = document.getElementById('wbPdfNext');
    lastPdfBtn = document.getElementById('wbPdfLast');
    presentBtn = document.getElementById('wbPresentBtn');
    exitPresentBtn = document.getElementById('wbExitPresentBtn');
    toggleToolbarBtn = document.getElementById('wbToggleToolbarBtn');
    toolbarEl = document.querySelector('.wb-toolbar');
    presToolsBtn = document.getElementById('wbPresToolsBtn');
    presToolPanel = document.getElementById('wbPresToolPanel');
    presHideToolsBtn = document.getElementById('wbPresHideToolsBtn');
    subjectSelect = document.getElementById('wbSubjectSelect');
    subjectDrawer = document.getElementById('wbSubjectDrawer');
    docTitleLabel = document.getElementById('wbDocTitle');
    headerPageStatus = document.getElementById('wbHeaderPageStatus');
    emptyStateEl = document.getElementById('wbEmptyState');

    // Presentation Header Elements
    presHeader = document.getElementById('wbPresHeader');
    presDocTitle = document.getElementById('wbPresDocTitle');
    presPdfNav = document.getElementById('wbPresPdfNav');
    presPdfPrev = document.getElementById('wbPresPdfPrev');
    presPdfNext = document.getElementById('wbPresPdfNext');
    presPdfPageNum = document.getElementById('wbPresPdfPageNum');
    presHeaderToolsBtn = document.getElementById('wbPresHeaderToolsBtn');
    presHeaderAssetsBtn = document.getElementById('wbPresHeaderAssetsBtn');
    presExitBtn = document.getElementById('wbPresExitBtn');
    presQuickActionsWrap = document.getElementById('wbPresQuickActionsWrap');
    presQuickActionsBtn = document.getElementById('wbPresQuickActionsBtn');
    presQuickActionsMenu = document.getElementById('wbPresQuickActionsMenu');
    presPdfUploadBtn = document.getElementById('wbPresPdfUploadBtn');
    presImgUploadBtn = document.getElementById('wbPresImgUploadBtn');
    presBgWrap = document.getElementById('wbPresBgWrap');
    presBgBtn = document.getElementById('wbPresBgBtn');
    presBgMenu = document.getElementById('wbPresBgMenu');

    // Assets Trigger Buttons
    headerAssetsBtn = document.getElementById('wbHeaderAssetsBtn');
    toolbarAssetsBtn = document.getElementById('wbToolbarAssetsBtn');
    closeAssetsDrawerBtn = document.getElementById('wbCloseAssetsDrawerBtn');

    // Phase 2 Elements
    assetsDrawer = document.getElementById('wbAssetsDrawer');
    blocksLayer = document.getElementById('wbBlocksLayer');
    spotlightCanvas = document.getElementById('wbSpotlightCanvas');
    if (spotlightCanvas) spotlightCtx = spotlightCanvas.getContext('2d');
    laserCanvas = document.getElementById('wbLaserCanvas');
    if (laserCanvas) laserCtx = laserCanvas.getContext('2d');
    quickActionsMenu = document.getElementById('wbQuickActionsMenu');
    lessonFlowBar = document.getElementById('wbLessonFlowBar');

    // Phase 2.5 Elements
    pdfCanvas = document.getElementById('wbPdfCanvas');
    if (pdfCanvas) pdfCtx = pdfCanvas.getContext('2d', { willReadFrequently: true });
    surfaceSelect = document.getElementById('wbSurfaceSelect');
    lineStyleBtn = document.getElementById('wbLineStyleBtn');
    stylusOnlyBtn = document.getElementById('wbStylusOnlyBtn');
    pdfChalkboardBtn = document.getElementById('wbPdfChalkboardBtn');
    presPdfChalkboardBtn = document.getElementById('wbPresPdfChalkboardBtn');
    presStylusBtn = document.getElementById('wbPresStylusBtn');

    // Phase 3 Elements (Dedicated Image Layer & Recording Controls)
    imageCanvas = document.getElementById('wbImageCanvas');
    if (imageCanvas) imageCtx = imageCanvas.getContext('2d');

    wbRecordBtn = document.getElementById('wbRecordBtn');
    wbRecordBtnText = document.getElementById('wbRecordBtnText');
    wbRecordingIndicator = document.getElementById('wbRecordingIndicator');
    wbRecordingTimer = document.getElementById('wbRecordingTimer');
    wbRecordMicCheckbox = document.getElementById('wbRecordMicCheckbox');
    wbMicIcon = document.getElementById('wbMicIcon');

    wbPresRecordBtn = document.getElementById('wbPresRecordBtn');
    wbPresRecordBtnText = document.getElementById('wbPresRecordBtnText');
    wbPresRecordingIndicator = document.getElementById('wbPresRecordingIndicator');
    wbPresRecordingTimer = document.getElementById('wbPresRecordingTimer');

    wbRecordingModal = document.getElementById('wbRecordingModal');
    wbRecVideoPlayer = document.getElementById('wbRecVideoPlayer');
    wbRecDurationLabel = document.getElementById('wbRecDurationLabel');
    wbRecFormatLabel = document.getElementById('wbRecFormatLabel');
    wbRecAudioLabel = document.getElementById('wbRecAudioLabel');
    wbRecDeleteBtn = document.getElementById('wbRecDeleteBtn');
    wbRecPlayBtn = document.getElementById('wbRecPlayBtn');
    wbRecDownloadBtn = document.getElementById('wbRecDownloadBtn');
    wbRecCloseBtn = document.getElementById('wbRecCloseBtn');

    // Phase 2.8 Elements (Selection Overlay, Popovers, Onboarding)
    selectionOverlay = document.getElementById('wbSelectionOverlay');
    selectionBox = document.getElementById('wbSelectionBox');
    selectionToolbar = document.getElementById('wbSelectionToolbar');
    selTypeBadge = document.getElementById('wbSelTypeBadge');
    selTypeText = document.getElementById('wbSelTypeText');
    selDuplicateBtn = document.getElementById('wbSelDuplicateBtn');
    selLockBtn = document.getElementById('wbSelLockBtn');
    selLockIcon = document.getElementById('wbSelLockIcon');
    selForwardBtn = document.getElementById('wbSelForwardBtn');
    selBackBtn = document.getElementById('wbSelBackBtn');
    selDeleteBtn = document.getElementById('wbSelDeleteBtn');
    shapesBtn = document.getElementById('wbShapesBtn');
    mathBtn = document.getElementById('wbMathBtn');
    shapesPopover = document.getElementById('wbShapesPopover');
    mathPopover = document.getElementById('wbMathPopover');
    emptyReopenBtn = document.getElementById('wbEmptyReopenBtn');
    emptyDismissBtn = document.getElementById('wbEmptyDismissBtn');

    initRecordingUI();
    initSelectionOverlayUI();

    // Phase 1 P0: Dynamic Transient Preview Canvas for Zero-Copy Previews (Highlighter & Shapes)
    if (canvasContainer && canvas && !previewCanvas) {
      previewCanvas = document.createElement('canvas');
      previewCanvas.id = 'wbPreviewCanvas';
      previewCanvas.className = 'wb-preview-canvas';
      previewCanvas.style.position = 'absolute';
      previewCanvas.style.top = '0';
      previewCanvas.style.left = '0';
      previewCanvas.style.pointerEvents = 'none';
      previewCanvas.style.zIndex = '9';
      previewCanvas.style.display = 'none';
      previewCanvas.setAttribute('aria-hidden', 'true');
      canvasContainer.insertBefore(previewCanvas, canvas);
      previewCtx = previewCanvas.getContext('2d');
    }

    // Setup Canvas Sizing & Crisp High-DPI Resolution
    resizeCanvas();
    window.addEventListener('resize', () => {
      invalidateCanvasRect();
      debounce(resizeCanvas, 120)();
    });
    window.addEventListener('scroll', invalidateCanvasRect, { passive: true });
    if (canvasContainer) {
      canvasContainer.addEventListener('scroll', invalidateCanvasRect, { passive: true });
    }

    // Attach Unified Pointer Events (Mouse, Touch & Stylus)
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointercancel', handlePointerCancel);
    canvas.addEventListener('pointerleave', handlePointerLeave);

    // Prevent Touch Dragging Page Scroll on Canvas
    canvas.addEventListener('touchstart', (e) => {
      if (state.currentTool !== 'text') {
        e.preventDefault();
      }
    }, { passive: false });

    // Initialize UI Controls & Event Listeners
    setupUIControls();
    setupEmptyState();
    setupDirectTextInput();
    setupKeyboardShortcuts();
    initLessonBlocks();
    initSpotlightAndLaser();
    renderAnnotationsGrid('all');
    updateAdRailFallback();
    initConsentEngine();

    // Close Drawers & Dropdowns on click outside
    document.addEventListener('click', (e) => {
      const subjectDropdownMenu = document.getElementById('wbSubjectDropdownMenu');
      if (subjectDropdownMenu && subjectDropdownMenu.style.display !== 'none' && !subjectDropdownMenu.contains(e.target) && !e.target.closest('#wbSubjectSwitcherBtn')) {
        toggleSubjectDropdown(false);
      }
      if (state.isSubjectDrawerOpen && subjectDrawer && !subjectDrawer.contains(e.target) && !e.target.closest('.wb-drawer-trigger-btn')) {
        toggleSubjectDrawer(false);
      }
      if (state.isAssetsDrawerOpen && assetsDrawer && !assetsDrawer.contains(e.target) &&
          !e.target.closest('#wbHeaderAssetsBtn') &&
          !e.target.closest('#wbToolbarAssetsBtn') &&
          !e.target.closest('#wbPresHeaderAssetsBtn') &&
          !e.target.closest('#wbPresAssetsBtn')) {
        toggleAssetsDrawer(false);
      }
      if (state.isPresToolPanelOpen && presToolPanel && !presToolPanel.contains(e.target) &&
          !e.target.closest('#wbPresHeaderToolsBtn') &&
          !e.target.closest('#wbPresToolsBtn')) {
        togglePresToolPanel(false);
      }
      if (state.isQuickActionsOpen && quickActionsMenu && !quickActionsMenu.contains(e.target) && !e.target.closest('#wbQuickActionsBtn')) {
        toggleQuickActions(false);
      }
      if (state.isPresQuickActionsOpen && presQuickActionsMenu && !presQuickActionsMenu.contains(e.target) && !e.target.closest('#wbPresQuickActionsBtn')) {
        togglePresQuickActions(false);
      }
      if (state.isPresBgMenuOpen && presBgMenu && !presBgMenu.contains(e.target) && !e.target.closest('#wbPresBgBtn')) {
        togglePresBgMenu(false);
      }
      if (state.isShapesPopoverOpen && shapesPopover && !shapesPopover.contains(e.target) && !e.target.closest('#wbShapesBtn')) {
        toggleShapesPopover(false);
      }
      if (state.isMathPopoverOpen && mathPopover && !mathPopover.contains(e.target) && !e.target.closest('#wbMathBtn')) {
        toggleMathPopover(false);
      }
    });

    if (assetsDrawer) {
      assetsDrawer.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    if (presToolPanel) {
      presToolPanel.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    if (presQuickActionsMenu) {
      presQuickActionsMenu.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    if (presBgMenu) {
      presBgMenu.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    // Initialize Surface and Pattern UI states
    setCanvasSurface(state.canvasSurface || 'white');
    updatePresBgActiveState(state.gridPattern || 'dots');

    // Save Initial Blank State
    saveState();

    // Track Analytics Event
    TeachingSession.logAction('whiteboard_open');
  }

  function setupEmptyState() {
    if (!emptyStateEl) return;
    const uploadPdfBtn = document.getElementById('wbEmptyUploadPdfBtn');
    if (uploadPdfBtn) {
      uploadPdfBtn.addEventListener('click', () => {
        const pdfInput = document.getElementById('wbPdfInput');
        if (pdfInput) pdfInput.click();
      });
    }
    const uploadImgBtn = document.getElementById('wbEmptyUploadImgBtn');
    if (uploadImgBtn) {
      uploadImgBtn.addEventListener('click', () => {
        const imgInput = document.getElementById('wbImgInput');
        if (imgInput) imgInput.click();
      });
    }
    const blankBtn = document.getElementById('wbEmptyBlankBtn');
    if (blankBtn) {
      blankBtn.addEventListener('click', () => {
        hideEmptyState();
      });
    }
    const textBtn = document.getElementById('wbEmptyTextBtn');
    if (textBtn) {
      textBtn.addEventListener('click', () => {
        hideEmptyState();
        selectTool('text');
      });
    }
    if (emptyDismissBtn) {
      emptyDismissBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        hideEmptyState();
      });
    }
    if (emptyReopenBtn) {
      emptyReopenBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (emptyStateEl) {
          emptyStateEl.style.display = 'block';
          emptyStateEl.classList.remove('hidden');
        }
        if (emptyReopenBtn) {
          emptyReopenBtn.style.display = 'none';
        }
      });
    }
  }

  function hideEmptyState() {
    if (emptyStateEl) {
      emptyStateEl.style.display = 'none';
      emptyStateEl.classList.add('hidden');
    }
    if (emptyReopenBtn) {
      emptyReopenBtn.style.display = 'inline-flex';
    }
  }

  function showEmptyState() {
    if (emptyStateEl && state.materialType === 'blank' && state.historyIndex <= 0) {
      emptyStateEl.style.display = 'block';
      emptyStateEl.classList.remove('hidden');
      if (emptyReopenBtn) {
        emptyReopenBtn.style.display = 'none';
      }
    }
  }

  function toggleEmptyState(force) {
    const show = force !== undefined ? !!force : (emptyStateEl && emptyStateEl.style.display === 'none');
    if (show) {
      if (emptyStateEl) {
        emptyStateEl.style.display = 'block';
        emptyStateEl.classList.remove('hidden');
      }
      if (emptyReopenBtn) {
        emptyReopenBtn.style.display = 'none';
      }
    } else {
      hideEmptyState();
    }
  }

  function updateDocumentHeaderInfo() {
    if (docTitleLabel) {
      let name = state.materialName || 'Lesson Whiteboard';
      name = name.replace(/\.(pdf|png|jpe?g|webp|svg)$/i, '');
      docTitleLabel.textContent = name;
      docTitleLabel.title = state.materialName || 'Lesson Whiteboard';
    }
    if (headerPageStatus) {
      if (state.pdfLoaded && state.pdfTotalPages > 1) {
        headerPageStatus.textContent = `Page ${state.pdfPageNum} / ${state.pdfTotalPages}`;
        headerPageStatus.style.display = 'inline-flex';
      } else {
        const modeMap = {
          general: 'GENERAL STUDIO',
          math: 'MATHEMATICS',
          science: 'SCIENCE STUDIO',
          english: 'ENGLISH & GRAMMAR',
          speech: 'PUBLIC SPEAKING'
        };
        headerPageStatus.textContent = modeMap[state.subjectMode] || 'STUDIO';
        headerPageStatus.style.display = 'inline-flex';
      }
    }
    updatePresentationHeader();
  }

  function updatePresentationHeader() {
    const titleEl = document.getElementById('wbPresDocTitle');
    if (titleEl) {
      let name = state.materialName || 'Blank Whiteboard';
      name = name.replace(/\.(pdf|png|jpe?g|webp|svg)$/i, '');
      titleEl.textContent = name;
      titleEl.title = state.materialName || 'Blank Whiteboard';
    }

    const pdfNavEl = document.getElementById('wbPresPdfNav');
    const pdfPageNumEl = document.getElementById('wbPresPdfPageNum');
    const pdfPrevEl = document.getElementById('wbPresPdfPrev');
    const pdfNextEl = document.getElementById('wbPresPdfNext');

    if (state.materialType === 'pdf' && state.pdfLoaded && state.pdfTotalPages > 1) {
      if (pdfNavEl) pdfNavEl.style.display = 'flex';
      if (pdfPageNumEl) pdfPageNumEl.textContent = `Page ${state.pdfPageNum} / ${state.pdfTotalPages}`;
      if (pdfPrevEl) pdfPrevEl.disabled = state.pdfPageNum <= 1;
      if (pdfNextEl) pdfNextEl.disabled = state.pdfPageNum >= state.pdfTotalPages;
    } else {
      if (pdfNavEl) pdfNavEl.style.display = 'none';
    }
  }

  /* ============================================================
     CANVAS SIZING & HIGH-DPI SHARPNESS
     ============================================================ */
  function resizeCanvas() {
    if (!canvasContainer || !canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const clientW = canvasContainer.clientWidth;
    const clientH = canvasContainer.clientHeight;
    if (clientW <= 0 || clientH <= 0) return;

    // Strict integer backing-store dimensions
    const backingW = Math.round(clientW * dpr);
    const backingH = Math.round(clientH * dpr);

    // Match CSS display bounds exactly to backing store to eliminate GPU blur
    const cssW = backingW / dpr;
    const cssH = backingH / dpr;

    // Preserve Current Canvas Content Before Resize
    let tempCanvas = null;
    if (canvas.width > 0 && canvas.height > 0) {
      tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(canvas, 0, 0);
    }

    // Assign Dimensions
    canvas.width = backingW;
    canvas.height = backingH;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';

    if (pdfCanvas) {
      pdfCanvas.width = backingW;
      pdfCanvas.height = backingH;
      pdfCanvas.style.width = cssW + 'px';
      pdfCanvas.style.height = cssH + 'px';
      if (pdfCtx) {
        pdfCtx.setTransform(1, 0, 0, 1, 0, 0);
        pdfCtx.scale(dpr, dpr);
        pdfCtx.imageSmoothingEnabled = true;
        pdfCtx.imageSmoothingQuality = 'high';
      }
    }

    if (imageCanvas) {
      imageCanvas.width = backingW;
      imageCanvas.height = backingH;
      imageCanvas.style.width = cssW + 'px';
      imageCanvas.style.height = cssH + 'px';
      if (imageCtx) {
        imageCtx.setTransform(1, 0, 0, 1, 0, 0);
        imageCtx.scale(dpr, dpr);
        imageCtx.imageSmoothingEnabled = true;
        imageCtx.imageSmoothingQuality = 'high';
        redrawImageCanvas();
      }
    }

    if (spotlightCanvas) {
      spotlightCanvas.width = backingW;
      spotlightCanvas.height = backingH;
      spotlightCanvas.style.width = cssW + 'px';
      spotlightCanvas.style.height = cssH + 'px';
      if (spotlightCtx) {
        spotlightCtx.setTransform(1, 0, 0, 1, 0, 0);
        spotlightCtx.scale(dpr, dpr);
      }
    }

    if (laserCanvas) {
      laserCanvas.width = backingW;
      laserCanvas.height = backingH;
      laserCanvas.style.width = cssW + 'px';
      laserCanvas.style.height = cssH + 'px';
      if (laserCtx) {
        laserCtx.setTransform(1, 0, 0, 1, 0, 0);
        laserCtx.scale(dpr, dpr);
      }
    }

    if (previewCanvas) {
      previewCanvas.width = backingW;
      previewCanvas.height = backingH;
      previewCanvas.style.width = cssW + 'px';
      previewCanvas.style.height = cssH + 'px';
      if (previewCtx) {
        previewCtx.setTransform(1, 0, 0, 1, 0, 0);
        previewCtx.scale(dpr, dpr);
        previewCtx.imageSmoothingEnabled = true;
        previewCtx.imageSmoothingQuality = 'high';
      }
    }

    updateCachedCanvasRect();

    // Reset Context Transform Matrix & Apply DPR Scale
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Restore Content
    if (tempCanvas) {
      ctx.drawImage(tempCanvas, 0, 0, tempCanvas.width / dpr, tempCanvas.height / dpr);
    } else {
      redrawCanvas();
    }

    if (state.pdfLoaded && state.pdfDoc) {
      renderPdfPage(state.pdfPageNum);
    }
  }

  /* ============================================================
     POINTER EVENT HANDLERS (MOUSE, TOUCH, STYLUS) & CACHED GEOMETRY
     ============================================================ */
  function updateCachedCanvasRect() {
    if (canvas && typeof canvas.getBoundingClientRect === 'function') {
      cachedCanvasRect = canvas.getBoundingClientRect();
    }
  }

  function getCachedCanvasRect() {
    if (!cachedCanvasRect || cachedCanvasRect.width === 0 || cachedCanvasRect.height === 0) {
      updateCachedCanvasRect();
    }
    return cachedCanvasRect || (canvas && canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { left: 0, top: 0, width: 1, height: 1 });
  }

  function invalidateCanvasRect() {
    cachedCanvasRect = null;
  }

  function getCanvasCoords(e) {
    const rect = getCachedCanvasRect();
    const clientX = (e && typeof e.clientX === 'number') ? e.clientX : (e && e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const clientY = (e && typeof e.clientY === 'number') ? e.clientY : (e && e.touches && e.touches[0] ? e.touches[0].clientY : 0);

    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.width / dpr;
    const cssH = canvas.height / dpr;

    const scaleX = cssW / (rect.width || cssW);
    const scaleY = cssH / (rect.height || cssH);

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    return {
      x,
      y,
      rawX: clientX - rect.left,
      rawY: clientY - rect.top,
      pressure: (e && typeof e.pressure === 'number' && e.pressure > 0) ? e.pressure : 0.5
    };
  }

  function getEraserSize(width) {
    const w = typeof width === 'number' && width > 0 ? width : 4;
    return Math.max(8, Math.min(56, Math.round(w * 2.5 + 6)));
  }

  function updateEraserCursor() {
    if (!canvas) return;
    if (state.currentTool !== 'eraser') {
      canvas.style.cursor = '';
      return;
    }
    const size = getEraserSize(state.strokeWidth);
    const cursorSize = Math.max(14, Math.min(64, Math.round(size)));
    const half = cursorSize / 2;
    const r = Math.max(2, half - 1.5);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cursorSize}" height="${cursorSize}" viewBox="0 0 ${cursorSize} ${cursorSize}"><circle cx="${half}" cy="${half}" r="${r}" fill="rgba(255,255,255,0.3)" stroke="#333333" stroke-width="1.5" stroke-dasharray="3,2"/></svg>`;
    const url = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    canvas.style.cursor = `url("${url}") ${half} ${half}, crosshair`;
  }

  function drawHighlighterPreview(points) {
    if (!points || points.length === 0 || !previewCtx || !previewCanvas) return;
    previewCtx.save();
    previewCtx.setTransform(1, 0, 0, 1, 0, 0);
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    const dpr = window.devicePixelRatio || 1;
    previewCtx.scale(dpr, dpr);
    previewCtx.globalAlpha = 0.22;
    previewCtx.strokeStyle = state.strokeColor;
    previewCtx.lineWidth = Math.max(state.strokeWidth * 3, 24);
    previewCtx.lineCap = 'round';
    previewCtx.lineJoin = 'round';

    previewCtx.beginPath();
    previewCtx.moveTo(points[0].x, points[0].y);
    if (points.length === 1) {
      previewCtx.lineTo(points[0].x + 0.1, points[0].y);
    } else {
      for (let i = 1; i < points.length; i++) {
        previewCtx.lineTo(points[i].x, points[i].y);
      }
    }
    previewCtx.stroke();
    previewCtx.restore();
  }

  function processBatchedDrawing() {
    drawRafId = null;
    if (!state.isDrawing || pendingPoints.length === 0) return;

    const batch = pendingPoints;
    pendingPoints = [];

    if (state.currentTool === 'pen') {
      for (let k = 0; k < batch.length; k++) {
        const pt = batch[k];
        const last = strokePoints[strokePoints.length - 1];
        if (last && Math.hypot(pt.x - last.x, pt.y - last.y) < 0.5) {
          continue;
        }
        strokePoints.push(pt);
      }

      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = state.strokeColor;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (let i = lastRenderedIndex; i < strokePoints.length - 1; i++) {
        const p0 = strokePoints[i];
        const p1 = strokePoints[i + 1];
        const press = p1.pressure > 0 ? p1.pressure : (p0.pressure > 0 ? p0.pressure : 0.5);
        ctx.lineWidth = state.strokeWidth * (press > 0 ? press * 1.5 : 1);

        const midX = (p0.x + p1.x) / 2;
        const midY = (p0.y + p1.y) / 2;

        ctx.beginPath();
        if (i === 0) {
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(midX, midY);
        } else {
          const prevMidX = (strokePoints[i - 1].x + p0.x) / 2;
          const prevMidY = (strokePoints[i - 1].y + p0.y) / 2;
          ctx.moveTo(prevMidX, prevMidY);
          ctx.quadraticCurveTo(p0.x, p0.y, midX, midY);
        }
        ctx.stroke();
      }
      ctx.restore();

      lastRenderedIndex = Math.max(0, strokePoints.length - 1);
      const latestPt = strokePoints[strokePoints.length - 1];
      state.lastX = latestPt.x;
      state.lastY = latestPt.y;

    } else if (state.currentTool === 'highlighter') {
      for (let k = 0; k < batch.length; k++) {
        state.currentPath.push(batch[k]);
      }
      drawHighlighterPreview(state.currentPath);
      const latestPt = batch[batch.length - 1];
      state.lastX = latestPt.x;
      state.lastY = latestPt.y;

    } else if (state.currentTool === 'eraser') {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = getEraserSize(state.strokeWidth);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (let k = 0; k < batch.length; k++) {
        const pt = batch[k];
        ctx.beginPath();
        ctx.moveTo(state.lastX, state.lastY);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
        state.lastX = pt.x;
        state.lastY = pt.y;
      }
      ctx.restore();

    } else if (isShapeTool(state.currentTool)) {
      const latestPt = batch[batch.length - 1];
      redrawCanvas();
      drawShapePreview(state.startX, state.startY, latestPt.x, latestPt.y, state.currentTool, true);
      state.lastX = latestPt.x;
      state.lastY = latestPt.y;
    }
    markRecordingDirty();
  }

  function flushPendingDrawing() {
    if (drawRafId) {
      cancelAnimationFrame(drawRafId);
      drawRafId = null;
    }
    if (pendingPoints.length > 0) {
      processBatchedDrawing();
    }
  }

  const SHAPE_TOOLS = [
    'line', 'arrow', 'double_arrow', 'curved_arrow', 'callout',
    'rectangle', 'rounded_rect', 'square', 'circle', 'ellipse',
    'triangle', 'right_triangle', 'isosceles_triangle', 'equilateral_triangle',
    'parallelogram', 'rhombus', 'trapezoid', 'pentagon', 'hexagon',
    'arc', 'sector', 'angle', 'protractor',
    'coord_plane', 'number_line', 'fraction_bar', 'ruler'
  ];

  function isShapeTool(tool) {
    return SHAPE_TOOLS.includes(tool);
  }

  function handlePointerDown(e) {
    hideEmptyState();

    if (state.isLaserActive) {
      updateLaser(e);
      return;
    }

    if (state.currentTool === 'pan' || e.button === 1 || e.buttons === 4) {
      state.isPanning = true;
      state.panStartX = e.clientX - state.panX;
      state.panStartY = e.clientY - state.panY;
      canvas.classList.add('pan-mode');
      return;
    }

    // PHASE 2.8: REAL TEACHING OBJECT SELECTION ENGINE
    if (state.currentTool === 'select') {
      const coords = getCanvasCoords(e);
      const hit = hitTestTeachingObjects(coords.x, coords.y);
      if (hit) {
        selectObject(hit);
        if (!hit.locked) {
          startSelectionDrag('move', e);
        }
        return;
      } else {
        deselectObject();
        return;
      }
    }

    // STYLUS ONLY MODE (Phase 2.5):
    // When enabled, suppress touch pointer events for drawing to reject accidental palm marks.
    // Stylus (pointerType === 'pen') and Desktop Mouse (pointerType === 'mouse') remain active.
    if (state.stylusOnlyMode && e.pointerType === 'touch') {
      return;
    }

    // Direct-on-Canvas Text Tool
    if (state.currentTool === 'text') {
      if (state.isEditingText) {
        commitDirectText();
      }
      const coords = getCanvasCoords(e);
      startDirectText(coords.rawX, coords.rawY, coords.x, coords.y);
      return;
    }

    if (state.isEditingText) {
      commitDirectText();
    }

    // Refresh canvas geometry cache at start of stroke
    updateCachedCanvasRect();

    // Pointer capture for smooth gestures
    if (e.pointerId !== undefined && typeof canvas.setPointerCapture === 'function') {
      try {
        canvas.setPointerCapture(e.pointerId);
        state.activePointerId = e.pointerId;
      } catch (err) {}
    }

    state.isDrawing = true;
    markRecordingDirty();
    invalidateCanvasRect();
    const coords = getCanvasCoords(e);
    state.startX = coords.x;
    state.startY = coords.y;
    state.lastX = coords.x;
    state.lastY = coords.y;

    if (drawRafId) {
      cancelAnimationFrame(drawRafId);
      drawRafId = null;
    }
    pendingPoints = [];
    strokePoints = [{ x: coords.x, y: coords.y, pressure: coords.pressure }];
    lastRenderedIndex = 0;

    if (state.currentTool === 'pen') {
      // Immediate crisp single dot at contact point
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = state.strokeColor;
      const press = coords.pressure > 0 ? coords.pressure : 0.5;
      const r = Math.max(0.75, (state.strokeWidth * (press > 0 ? press * 1.5 : 1)) / 2);
      ctx.beginPath();
      ctx.arc(coords.x, coords.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (state.currentTool === 'highlighter') {
      state.currentPath = [{ x: coords.x, y: coords.y }];
      if (previewCanvas && previewCtx) {
        previewCanvas.style.zIndex = '9';
        previewCanvas.style.display = 'block';
        drawHighlighterPreview(state.currentPath);
      }
    } else if (state.currentTool === 'eraser') {
      // Immediate precision eraser dot at contact point
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      const eraserRadius = getEraserSize(state.strokeWidth) / 2;
      ctx.beginPath();
      ctx.arc(coords.x, coords.y, eraserRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function handlePointerMove(e) {
    const coords = getCanvasCoords(e);
    state.lastPointerX = coords.x;
    state.lastPointerY = coords.y;
    state.isPointerOnCanvas = true;
    markRecordingDirty();

    if (state.isSpotlightActive) {
      updateSpotlight(e);
    }
    if (state.isLaserActive) {
      updateLaser(e);
    }

    // Active Teaching Object Dragging / Resizing
    if (state.selectionDragMode && state.selectedObject && state.dragInitialState) {
      handleSelectionDragMove(e);
      return;
    }

    if (state.isPanning) {
      state.panX = e.clientX - state.panStartX;
      state.panY = e.clientY - state.panY;
      applyTransform();
      return;
    }

    if (!state.isDrawing) return;

    pendingPoints.push(coords);

    if (!drawRafId) {
      drawRafId = requestAnimationFrame(processBatchedDrawing);
    }
  }

  function handlePointerUp(e) {
    if (state.activePointerId !== undefined && state.activePointerId !== null) {
      try {
        if (typeof canvas.releasePointerCapture === 'function') {
          canvas.releasePointerCapture(state.activePointerId);
        }
      } catch (err) {}
      state.activePointerId = null;
    }

    if (state.selectionDragMode) {
      handleSelectionDragEnd(e);
      return;
    }

    if (state.isPanning) {
      state.isPanning = false;
      canvas.classList.remove('pan-mode');
      return;
    }

    if (!state.isDrawing) return;

    flushPendingDrawing();

    const coords = getCanvasCoords(e);

    if (state.currentTool === 'pen') {
      if (strokePoints.length >= 2) {
        const pPrev = strokePoints[strokePoints.length - 2];
        const pFinal = strokePoints[strokePoints.length - 1];
        const lastMidX = (pPrev.x + pFinal.x) / 2;
        const lastMidY = (pPrev.y + pFinal.y) / 2;

        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = state.strokeColor;
        const press = pFinal.pressure > 0 ? pFinal.pressure : 0.5;
        ctx.lineWidth = state.strokeWidth * (press > 0 ? press * 1.5 : 1);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(lastMidX, lastMidY);
        ctx.lineTo(pFinal.x, pFinal.y);
        ctx.stroke();
        ctx.restore();
      }
      strokePoints = [];
      lastRenderedIndex = 0;

    } else if (state.currentTool === 'highlighter') {
      if (previewCanvas && previewCtx) {
        previewCtx.save();
        previewCtx.setTransform(1, 0, 0, 1, 0, 0);
        previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        previewCtx.restore();
        previewCanvas.style.display = 'none';
      }

      if (state.currentPath && state.currentPath.length > 0) {
        if (coords && (coords.x !== state.lastX || coords.y !== state.lastY)) {
          state.currentPath.push({ x: coords.x, y: coords.y });
        }
        drawHighlighterStroke(state.currentPath);
        state.currentPath = [];
      }

    } else if (state.currentTool === 'eraser') {
      strokePoints = [];

    } else if (isShapeTool(state.currentTool)) {
      redrawCanvas();
      drawShapePreview(state.startX, state.startY, coords.x, coords.y, state.currentTool, false);
      if (PedagogicalSignal && typeof PedagogicalSignal.record === 'function') {
        PedagogicalSignal.record('shape_drawn', { shape: state.currentTool }, 'pedagogical_structure');
      }
    }

    state.isDrawing = false;
    markRecordingDirty();

    // Commit Stroke to History Stack
    saveState();
    TeachingSession.logAction('whiteboard_draw', { tool: state.currentTool, subject: state.subjectMode });
  }

  function handlePointerCancel(e) {
    if (state.activePointerId !== undefined && state.activePointerId !== null) {
      try {
        if (typeof canvas.releasePointerCapture === 'function') {
          canvas.releasePointerCapture(state.activePointerId);
        }
      } catch (err) {}
      state.activePointerId = null;
    }

    if (drawRafId) {
      cancelAnimationFrame(drawRafId);
      drawRafId = null;
    }
    pendingPoints = [];
    strokePoints = [];
    lastRenderedIndex = 0;

    if (previewCanvas && previewCtx) {
      previewCtx.save();
      previewCtx.setTransform(1, 0, 0, 1, 0, 0);
      previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
      previewCtx.restore();
      previewCanvas.style.display = 'none';
    }

    if (state.isDrawing) {
      state.isDrawing = false;
      saveState();
    }
  }

  function handlePointerLeave(e) {
    state.isPointerOnCanvas = false;
    markRecordingDirty();
  }

  /* ============================================================
     TRANSLUCENT CLASSROOM HIGHLIGHTER LOGIC
     Renders uniform, non-buildup translucent marker strokes.
     Using destination-over ensures existing handwriting and text
     remain 100% crisp and readable in front of the highlight.
     ============================================================ */
  function drawHighlighterStroke(points) {
    if (!points || points.length === 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = state.strokeColor;
    ctx.lineWidth = Math.max(state.strokeWidth * 3, 24);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    if (points.length === 1) {
      ctx.lineTo(points[0].x + 0.1, points[0].y);
    } else {
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  /* ============================================================
     SHAPE, TRIANGLE & RULER DRAWING LOGIC
     ============================================================ */
  function drawShapePreview(sx, sy, ex, ey, tool, isPreview = true) {
    ctx.save();
    ctx.strokeStyle = state.strokeColor;
    ctx.fillStyle = state.strokeColor;
    ctx.lineWidth = state.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = 'source-over';

    if (isPreview) {
      ctx.globalAlpha = 0.85;
    }

    // Line Style Support (Solid / Dashed)
    if (state.lineStyle === 'dashed') {
      ctx.setLineDash([8, 6]);
    } else {
      ctx.setLineDash([]);
    }

    if (tool === 'line') {
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    } else if (tool === 'arrow') {
      const headLength = Math.max(12, Math.min(22, state.strokeWidth * 2.5 + 8));
      const angle = Math.atan2(ey - sy, ex - sx);

      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - headLength * Math.cos(angle - Math.PI / 6), ey - headLength * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(ex - headLength * Math.cos(angle + Math.PI / 6), ey - headLength * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
    } else if (tool === 'double_arrow') {
      const headLength = Math.max(12, Math.min(22, state.strokeWidth * 2.5 + 8));
      const angle = Math.atan2(ey - sy, ex - sx);

      // Shaft
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      ctx.setLineDash([]);
      // Arrowhead at end (ex, ey)
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - headLength * Math.cos(angle - Math.PI / 6), ey - headLength * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(ex - headLength * Math.cos(angle + Math.PI / 6), ey - headLength * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();

      // Arrowhead at start (sx, sy) pointing backwards
      const backAngle = angle + Math.PI;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - headLength * Math.cos(backAngle - Math.PI / 6), sy - headLength * Math.sin(backAngle - Math.PI / 6));
      ctx.lineTo(sx - headLength * Math.cos(backAngle + Math.PI / 6), sy - headLength * Math.sin(backAngle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
    } else if (tool === 'curved_arrow') {
      const dx = ex - sx;
      const dy = ey - sy;
      const dist = Math.hypot(dx, dy);

      if (dist < 4) {
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      } else {
        const mx = (sx + ex) / 2;
        const my = (sy + ey) / 2;
        // Natural bow curvature perpendicular to chord
        const offset = Math.min(dist * 0.28, 70);
        const cx = mx - (dy / dist) * offset;
        const cy = my + (dx / dist) * offset;

        // Curved shaft
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(cx, cy, ex, ey);
        ctx.stroke();

        // Terminal Arrowhead oriented along curve tangent at end
        ctx.setLineDash([]);
        const tanX = ex - cx;
        const tanY = ey - cy;
        const headAngle = Math.atan2(tanY, tanX);
        const headLength = Math.max(12, Math.min(22, state.strokeWidth * 2.5 + 8));

        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - headLength * Math.cos(headAngle - Math.PI / 6), ey - headLength * Math.sin(headAngle - Math.PI / 6));
        ctx.lineTo(ex - headLength * Math.cos(headAngle + Math.PI / 6), ey - headLength * Math.sin(headAngle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
      }
    } else if (tool === 'callout') {
      // Speech Callout: Rounded bubble with speech pointer tail
      const bx = Math.min(sx, ex);
      const by = Math.min(sy, ey);
      const bw = Math.max(Math.abs(ex - sx), 60);
      const bh = Math.max(Math.abs(ey - sy), 45);
      const radius = Math.min(12, bw / 4, bh / 4);
      const tailH = Math.min(16, bh * 0.3);
      const bubbleH = bh - tailH;

      ctx.beginPath();
      // Rounded bubble outline
      ctx.moveTo(bx + radius, by);
      ctx.lineTo(bx + bw - radius, by);
      ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + radius);
      ctx.lineTo(bx + bw, by + bubbleH - radius);
      ctx.quadraticCurveTo(bx + bw, by + bubbleH, bx + bw - radius, by + bubbleH);
      
      // Bottom edge with callout tail
      const tailX = bx + Math.min(30, bw * 0.25);
      ctx.lineTo(tailX + 24, by + bubbleH);
      ctx.lineTo(tailX, by + bh); // tail tip
      ctx.lineTo(tailX + 8, by + bubbleH);
      ctx.lineTo(bx + radius, by + bubbleH);
      ctx.quadraticCurveTo(bx, by + bubbleH, bx, by + bubbleH - radius);
      ctx.lineTo(bx, by + radius);
      ctx.quadraticCurveTo(bx, by, bx + radius, by);
      ctx.closePath();

      if (state.fillShape) {
        ctx.fill();
      } else {
        // Translucent contrast wash so callouts are readable on all surfaces
        ctx.save();
        ctx.fillStyle = (state.canvasSurface === 'chalkboard' || state.canvasSurface === 'blackboard')
          ? 'rgba(15, 23, 42, 0.45)'
          : 'rgba(255, 255, 255, 0.65)';
        ctx.fill();
        ctx.restore();
      }
      ctx.stroke();
    } else if (tool === 'rectangle') {
      const width = ex - sx;
      const height = ey - sy;
      ctx.beginPath();
      ctx.rect(sx, sy, width, height);
      if (state.fillShape) {
        ctx.fill();
      }
      ctx.stroke();
    } else if (tool === 'rounded_rect') {
      const rx = Math.min(sx, ex);
      const ry = Math.min(sy, ey);
      const rw = Math.abs(ex - sx);
      const rh = Math.abs(ey - sy);
      const r = Math.min(14, rw / 2, rh / 2);
      ctx.beginPath();
      ctx.moveTo(rx + r, ry);
      ctx.lineTo(rx + rw - r, ry);
      ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + r);
      ctx.lineTo(rx + rw, ry + rh - r);
      ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - r, ry + rh);
      ctx.lineTo(rx + r, ry + rh);
      ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - r);
      ctx.lineTo(rx, ry + r);
      ctx.quadraticCurveTo(rx, ry, rx + r, ry);
      ctx.closePath();
      if (state.fillShape) ctx.fill();
      ctx.stroke();
    } else if (tool === 'square') {
      const s = Math.min(Math.abs(ex - sx), Math.abs(ey - sy));
      const rx = ex >= sx ? sx : sx - s;
      const ry = ey >= sy ? sy : sy - s;
      ctx.beginPath();
      ctx.rect(rx, ry, s, s);
      if (state.fillShape) ctx.fill();
      ctx.stroke();
    } else if (tool === 'circle') {
      const radiusX = Math.abs(ex - sx) / 2;
      const radiusY = Math.abs(ey - sy) / 2;
      const centerX = sx + (ex - sx) / 2;
      const centerY = sy + (ey - sy) / 2;

      ctx.beginPath();
      ctx.ellipse(centerX, centerY, Math.max(radiusX, 1), Math.max(radiusY, 1), 0, 0, 2 * Math.PI);
      if (state.fillShape) {
        ctx.fill();
      }
      ctx.stroke();
    } else if (tool === 'ellipse') {
      const rx = Math.abs(ex - sx) / 2;
      const ry = Math.abs(ey - sy) / 2;
      const cx = sx + (ex - sx) / 2;
      const cy = sy + (ey - sy) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.max(rx, 1), Math.max(ry, 1), 0, 0, 2 * Math.PI);
      if (state.fillShape) ctx.fill();
      ctx.stroke();
    } else if (tool === 'triangle') {
      ctx.beginPath();
      ctx.moveTo(sx, ey);
      ctx.lineTo(ex, ey);
      ctx.lineTo((sx + ex) / 2, sy);
      ctx.closePath();
      if (state.fillShape) {
        ctx.fill();
      }
      ctx.stroke();
    } else if (tool === 'right_triangle') {
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx, ey);
      ctx.lineTo(ex, ey);
      ctx.closePath();
      if (state.fillShape) ctx.fill();
      ctx.stroke();

      // Right-angle indicator square at vertex (sx, ey)
      const isize = Math.min(16, Math.abs(ex - sx) * 0.22, Math.abs(ey - sy) * 0.22);
      if (isize >= 4) {
        const dx = ex >= sx ? 1 : -1;
        const dy = sy <= ey ? -1 : 1;
        ctx.beginPath();
        ctx.moveTo(sx, ey + isize * dy);
        ctx.lineTo(sx + isize * dx, ey + isize * dy);
        ctx.lineTo(sx + isize * dx, ey);
        ctx.stroke();
      }
    } else if (tool === 'isosceles_triangle') {
      ctx.beginPath();
      ctx.moveTo((sx + ex) / 2, sy);
      ctx.lineTo(ex, ey);
      ctx.lineTo(sx, ey);
      ctx.closePath();
      if (state.fillShape) ctx.fill();
      ctx.stroke();
    } else if (tool === 'equilateral_triangle') {
      const base = Math.abs(ex - sx);
      const h = base * (Math.sqrt(3) / 2) * (ey >= sy ? 1 : -1);
      const cx = (sx + ex) / 2;
      ctx.beginPath();
      ctx.moveTo(cx, sy);
      ctx.lineTo(sx, sy + h);
      ctx.lineTo(ex, sy + h);
      ctx.closePath();
      if (state.fillShape) ctx.fill();
      ctx.stroke();
    } else if (tool === 'parallelogram') {
      const skew = (ex - sx) * 0.22;
      ctx.beginPath();
      ctx.moveTo(sx + skew, sy);
      ctx.lineTo(ex, sy);
      ctx.lineTo(ex - skew, ey);
      ctx.lineTo(sx, ey);
      ctx.closePath();
      if (state.fillShape) ctx.fill();
      ctx.stroke();
    } else if (tool === 'rhombus') {
      const cx = (sx + ex) / 2;
      const cy = (sy + ey) / 2;
      ctx.beginPath();
      ctx.moveTo(cx, sy);
      ctx.lineTo(ex, cy);
      ctx.lineTo(cx, ey);
      ctx.lineTo(sx, cy);
      ctx.closePath();
      if (state.fillShape) ctx.fill();
      ctx.stroke();
    } else if (tool === 'trapezoid') {
      const inset = (ex - sx) * 0.22;
      ctx.beginPath();
      ctx.moveTo(sx + inset, sy);
      ctx.lineTo(ex - inset, sy);
      ctx.lineTo(ex, ey);
      ctx.lineTo(sx, ey);
      ctx.closePath();
      if (state.fillShape) ctx.fill();
      ctx.stroke();
    } else if (tool === 'pentagon') {
      const cx = (sx + ex) / 2;
      const cy = (sy + ey) / 2;
      const rx = Math.abs(ex - sx) / 2;
      const ry = Math.abs(ey - sy) / 2;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const ang = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        const px = cx + rx * Math.cos(ang);
        const py = cy + ry * Math.sin(ang);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      if (state.fillShape) ctx.fill();
      ctx.stroke();
    } else if (tool === 'hexagon') {
      const cx = (sx + ex) / 2;
      const cy = (sy + ey) / 2;
      const rx = Math.abs(ex - sx) / 2;
      const ry = Math.abs(ey - sy) / 2;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = -Math.PI / 2 + (i * 2 * Math.PI) / 6;
        const px = cx + rx * Math.cos(ang);
        const py = cy + ry * Math.sin(ang);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      if (state.fillShape) ctx.fill();
      ctx.stroke();
    } else if (tool === 'arc') {
      const cx = (sx + ex) / 2;
      const cy = (sy + ey) / 2;
      const r = Math.max(Math.hypot(ex - sx, ey - sy) / 2, 4);
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI * 0.75, Math.PI * 0.25);
      ctx.stroke();
    } else if (tool === 'sector') {
      const cx = sx;
      const cy = ey;
      const r = Math.max(Math.hypot(ex - sx, ey - sy), 10);
      const angle = Math.atan2(sy - ey, ex - sx);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, angle, 0);
      ctx.closePath();
      if (state.fillShape) ctx.fill();
      ctx.stroke();
    } else if (tool === 'angle') {
      // Ray 1: from vertex (sx, ey) horizontally to (ex, ey)
      // Ray 2: from vertex (sx, ey) diagonally to (ex, sy)
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(sx, ey);
      ctx.lineTo(ex, sy);
      ctx.stroke();

      const arm = Math.hypot(ex - sx, ey - sy);
      const arcR = Math.max(16, Math.min(48, arm * 0.35));
      const rad = Math.atan2(sy - ey, ex - sx);
      ctx.beginPath();
      ctx.arc(sx, ey, arcR, rad, 0);
      ctx.stroke();

      const deg = Math.abs(Math.round((rad * 180) / Math.PI)) || 45;
      const textX = sx + Math.cos(rad / 2) * (arcR + 18);
      const textY = ey + Math.sin(rad / 2) * (arcR + 18);
      ctx.save();
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.fillStyle = state.strokeColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${deg}°`, textX, textY);
      ctx.restore();
    } else if (tool === 'protractor') {
      const cx = (sx + ex) / 2;
      const cy = ey;
      const r = Math.max(Math.abs(ex - sx) / 2, 45);

      // Semicircle baseline & arc
      ctx.beginPath();
      ctx.moveTo(cx - r, cy);
      ctx.lineTo(cx + r, cy);
      ctx.arc(cx, cy, r, 0, Math.PI, true);
      ctx.closePath();
      ctx.save();
      ctx.fillStyle = (state.canvasSurface === 'chalkboard' || state.canvasSurface === 'blackboard')
        ? 'rgba(255, 255, 255, 0.08)' : 'rgba(37, 99, 235, 0.06)';
      ctx.fill();
      ctx.restore();
      ctx.stroke();

      // Origin center dot
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();

      // Degree radial ticks
      ctx.save();
      ctx.font = '9px Inter, sans-serif';
      ctx.fillStyle = state.strokeColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let deg = 0; deg <= 180; deg += 10) {
        const rad = Math.PI - (deg * Math.PI) / 180;
        const tickLen = deg % 30 === 0 ? 10 : (deg % 10 === 0 ? 5 : 3);
        const x1 = cx + (r - tickLen) * Math.cos(rad);
        const y1 = cy - (r - tickLen) * Math.sin(rad);
        const x2 = cx + r * Math.cos(rad);
        const y2 = cy - r * Math.sin(rad);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        if (deg % 30 === 0 && r >= 70) {
          const lx = cx + (r - 18) * Math.cos(rad);
          const ly = cy - (r - 18) * Math.sin(rad);
          ctx.fillText(deg + '°', lx, ly);
        }
      }
      ctx.restore();
    } else if (tool === 'coord_plane') {
      const bx = Math.min(sx, ex);
      const by = Math.min(sy, ey);
      const bw = Math.max(Math.abs(ex - sx), 120);
      const bh = Math.max(Math.abs(ey - sy), 120);
      const cx = bx + bw / 2;
      const cy = by + bh / 2;

      // Outer boundary box
      ctx.save();
      ctx.fillStyle = (state.canvasSurface === 'chalkboard' || state.canvasSurface === 'blackboard')
        ? 'rgba(15, 23, 42, 0.45)' : 'rgba(255, 255, 255, 0.7)';
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeRect(bx, by, bw, bh);

      // Grid background lines
      const step = Math.max(20, Math.min(40, bw / 10));
      ctx.save();
      ctx.strokeStyle = (state.canvasSurface === 'chalkboard' || state.canvasSurface === 'blackboard')
        ? 'rgba(255, 255, 255, 0.12)' : 'rgba(37, 99, 235, 0.12)';
      ctx.lineWidth = 1;
      for (let x = cx + step; x < bx + bw; x += step) {
        ctx.beginPath(); ctx.moveTo(x, by); ctx.lineTo(x, by + bh); ctx.stroke();
      }
      for (let x = cx - step; x > bx; x -= step) {
        ctx.beginPath(); ctx.moveTo(x, by); ctx.lineTo(x, by + bh); ctx.stroke();
      }
      for (let y = cy + step; y < by + bh; y += step) {
        ctx.beginPath(); ctx.moveTo(bx, y); ctx.lineTo(bx + bw, y); ctx.stroke();
      }
      for (let y = cy - step; y > by; y -= step) {
        ctx.beginPath(); ctx.moveTo(bx, y); ctx.lineTo(bx + bw, y); ctx.stroke();
      }
      ctx.restore();

      // Main Axes (Thicker)
      ctx.lineWidth = Math.max(2, state.strokeWidth);
      ctx.beginPath(); ctx.moveTo(bx + 6, cy); ctx.lineTo(bx + bw - 6, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, by + bh - 6); ctx.lineTo(cx, by + 6); ctx.stroke();

      // Arrowheads
      ctx.save();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(bx + bw - 6, cy);
      ctx.lineTo(bx + bw - 14, cy - 4);
      ctx.lineTo(bx + bw - 14, cy + 4);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(cx, by + 6);
      ctx.lineTo(cx - 4, by + 14);
      ctx.lineTo(cx + 4, by + 14);
      ctx.closePath();
      ctx.fill();

      // Labels & Origin
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('+x', bx + bw - 4, cy - 12);
      ctx.fillText('+y', cx + 14, by + 8);
      ctx.fillText('0', cx - 8, cy + 10);

      // Quadrant labels
      if (bw >= 160 && bh >= 160) {
        ctx.fillStyle = (state.canvasSurface === 'chalkboard' || state.canvasSurface === 'blackboard')
          ? 'rgba(255, 255, 255, 0.45)' : 'rgba(37, 99, 235, 0.5)';
        ctx.fillText('QI', cx + bw * 0.25, cy - bh * 0.25);
        ctx.fillText('QII', cx - bw * 0.25, cy - bh * 0.25);
        ctx.fillText('QIII', cx - bw * 0.25, cy + bh * 0.25);
        ctx.fillText('QIV', cx + bw * 0.25, cy + bh * 0.25);
      }
      ctx.restore();
    } else if (tool === 'number_line') {
      const bx = Math.min(sx, ex);
      const bw = Math.max(Math.abs(ex - sx), 160);
      const cy = (sy + ey) / 2;
      const count = 10;
      const step = bw / count;

      // Horizontal axis
      ctx.beginPath();
      ctx.moveTo(bx + 10, cy);
      ctx.lineTo(bx + bw - 10, cy);
      ctx.stroke();

      // Arrowheads
      ctx.save();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(bx + bw - 8, cy); ctx.lineTo(bx + bw - 16, cy - 4); ctx.lineTo(bx + bw - 16, cy + 4); ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(bx + 8, cy); ctx.lineTo(bx + 16, cy - 4); ctx.lineTo(bx + 16, cy + 4); ctx.closePath(); ctx.fill();

      // Ticks & Numbers
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      for (let i = 0; i <= count; i++) {
        const tx = bx + i * step;
        const val = i - count / 2;
        const isOrigin = val === 0;

        ctx.beginPath();
        ctx.moveTo(tx, cy - (isOrigin ? 9 : 6));
        ctx.lineTo(tx, cy + (isOrigin ? 9 : 6));
        ctx.lineWidth = isOrigin ? 2.5 : 1.5;
        ctx.stroke();

        ctx.fillStyle = isOrigin ? '#2563eb' : state.strokeColor;
        ctx.fillText(val.toString(), tx, cy + 10);
      }
      ctx.restore();
    } else if (tool === 'fraction_bar') {
      const bx = Math.min(sx, ex);
      const by = Math.min(sy, ey);
      const bw = Math.max(Math.abs(ex - sx), 140);
      const bh = Math.max(Math.abs(ey - sy), 46);
      const partitions = 4;
      const filled = 3;
      const partW = bw / partitions;

      // Outer outline
      ctx.beginPath();
      ctx.rect(bx, by, bw, bh);
      ctx.stroke();

      // Partitions
      for (let i = 0; i < partitions; i++) {
        const px = bx + i * partW;
        if (i > 0) {
          ctx.beginPath();
          ctx.moveTo(px, by);
          ctx.lineTo(px, by + bh);
          ctx.stroke();
        }

        // Shaded fill for numerator
        if (i < filled) {
          ctx.save();
          ctx.fillStyle = (state.canvasSurface === 'chalkboard' || state.canvasSurface === 'blackboard')
            ? 'rgba(16, 185, 129, 0.35)' : 'rgba(37, 99, 235, 0.22)';
          ctx.fillRect(px, by, partW, bh);
          ctx.restore();
        }

        // Segment fractional labels: 1/4
        ctx.save();
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillStyle = state.strokeColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`1/${partitions}`, px + partW / 2, by + bh / 2);
        ctx.restore();
      }

      // Main fraction title below bar
      ctx.save();
      ctx.font = 'bold 13px Inter, sans-serif';
      ctx.fillStyle = state.strokeColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`${filled}/${partitions}`, bx + bw / 2, by + bh + 8);
      ctx.restore();
    } else if (tool === 'ruler') {
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      const dist = Math.hypot(ex - sx, ey - sy);
      const angle = Math.atan2(ey - sy, ex - sx);

      for (let i = 0; i <= dist; i += 10) {
        const tx = sx + Math.cos(angle) * i;
        const ty = sy + Math.sin(angle) * i;
        const isMajor = (i % 50 === 0);
        const isMed = (i % 25 === 0);
        const tickLen = isMajor ? 12 : (isMed ? 8 : 4);
        const nx = Math.cos(angle + Math.PI / 2) * tickLen;
        const ny = Math.sin(angle + Math.PI / 2) * tickLen;

        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx + nx, ty + ny);
        ctx.stroke();

        if (isMajor && i > 0) {
          const lx = tx + Math.cos(angle + Math.PI / 2) * 18;
          const ly = ty + Math.sin(angle + Math.PI / 2) * 18;
          ctx.save();
          ctx.font = '9px Inter, sans-serif';
          ctx.fillStyle = state.strokeColor;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText((i / 10).toString(), lx, ly);
          ctx.restore();
        }
      }

      // Dynamic board-unit length badge
      const midX = (sx + ex) / 2;
      const midY = (sy + ey) / 2;
      ctx.save();
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.fillStyle = state.strokeColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${Math.round(dist)} units`, midX, midY - 6);
      ctx.restore();
    }

    ctx.restore();
  }

  /* ============================================================
     PHASE 2.8: TEACHING OBJECT SELECTION & MANIPULATION ENGINE
     ============================================================ */

  function initSelectionOverlayUI() {
    if (!selectionOverlay) return;

    // Attach drag handles (8 positions: nw, n, ne, e, se, s, sw, w)
    const handles = selectionOverlay.querySelectorAll('.wb-handle');
    handles.forEach((handle) => {
      handle.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!state.selectedObject || state.selectedObject.locked) return;

        const hType = handle.getAttribute('data-handle');
        startSelectionDrag('resize-' + hType, e);
      });
    });

    // Attach selection box dragging
    if (selectionBox) {
      selectionBox.addEventListener('pointerdown', (e) => {
        if (e.target.closest('#wbSelectionToolbar')) return;
        e.preventDefault();
        e.stopPropagation();

        if (!state.selectedObject || state.selectedObject.locked) return;

        startSelectionDrag('move', e);
      });
    }

    // Attach contextual floating toolbar buttons
    if (selDuplicateBtn) {
      selDuplicateBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        duplicateSelectedObject();
      });
    }

    if (selLockBtn) {
      selLockBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleLockSelectedObject();
      });
    }

    if (selForwardBtn) {
      selForwardBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        bringForwardSelectedObject();
      });
    }

    if (selBackBtn) {
      selBackBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        sendBackSelectedObject();
      });
    }

    if (selDeleteBtn) {
      selDeleteBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        deleteSelectedObject();
      });
    }
  }

  function hitTestTeachingObjects(x, y) {
    // 1. Top-down Priority 1: Lesson Blocks (reverse z-order)
    if (state.lessonBlocks && state.lessonBlocks.length > 0) {
      for (let i = state.lessonBlocks.length - 1; i >= 0; i--) {
        const b = state.lessonBlocks[i];
        const w = b.width || 300;
        const h = b.height || 120;
        if (x >= b.x && x <= b.x + w && y >= b.y && y <= b.y + h) {
          return {
            type: 'block',
            id: b.id,
            ref: b,
            bounds: { x: b.x, y: b.y, w: w, h: h },
            locked: !!b.locked
          };
        }
      }
    }

    // 2. Top-down Priority 2: Imported Images (reverse z-order)
    if (state.loadedImages && state.loadedImages.length > 0) {
      for (let i = state.loadedImages.length - 1; i >= 0; i--) {
        const img = state.loadedImages[i];
        if (x >= img.x && x <= img.x + img.w && y >= img.y && y <= img.y + img.h) {
          return {
            type: 'image',
            id: img.id,
            ref: img,
            bounds: { x: img.x, y: img.y, w: img.w, h: img.h },
            locked: !!img.locked
          };
        }
      }
    }

    // 3. Top-down Priority 3: PDF Teaching Worksheet Material
    if (state.pdfLoaded && state.pdfMaterialTransform) {
      const t = state.pdfMaterialTransform;
      if (x >= t.x && x <= t.x + t.width && y >= t.y && y <= t.y + t.height) {
        return {
          type: 'pdf',
          id: 'pdf_worksheet',
          ref: state.pdfMaterialTransform,
          bounds: { x: t.x, y: t.y, w: t.width, h: t.height },
          locked: !!t.locked
        };
      }
    }

    // 4. Empty Canvas
    return null;
  }

  function selectObject(target) {
    if (!target) {
      deselectObject();
      return;
    }

    state.selectedObject = target;

    if (selectionOverlay && selectionBox) {
      selectionOverlay.style.display = 'block';

      // Update badge label
      if (selTypeText) {
        if (target.type === 'image') selTypeText.textContent = 'Image';
        else if (target.type === 'pdf') selTypeText.textContent = 'PDF Page';
        else if (target.type === 'block') selTypeText.textContent = 'Lesson Block';
        else selTypeText.textContent = 'Object';
      }

      // Hide duplicate button for PDF (multi-page duplication not supported)
      if (selDuplicateBtn) {
        selDuplicateBtn.style.display = target.type === 'pdf' ? 'none' : 'inline-flex';
      }

      updateSelectionOverlay();
    }

    if (PedagogicalSignal && typeof PedagogicalSignal.record === 'function') {
      PedagogicalSignal.record('object_selected', { type: target.type });
    }
  }

  function deselectObject() {
    state.selectedObject = null;
    state.selectionDragMode = null;
    state.dragInitialState = null;
    if (selectionOverlay) {
      selectionOverlay.style.display = 'none';
    }
  }

  function updateSelectionOverlay() {
    if (!state.selectedObject || !selectionBox) {
      if (selectionOverlay) selectionOverlay.style.display = 'none';
      return;
    }

    // Re-sync bounds and lock status from referenced data model
    if (state.selectedObject.type === 'image') {
      const img = state.selectedObject.ref;
      state.selectedObject.bounds = { x: img.x, y: img.y, w: img.w, h: img.h };
      state.selectedObject.locked = !!img.locked;
    } else if (state.selectedObject.type === 'pdf') {
      const t = state.pdfMaterialTransform;
      if (t) {
        state.selectedObject.bounds = { x: t.x, y: t.y, w: t.width, h: t.height };
        state.selectedObject.locked = !!t.locked;
      }
    } else if (state.selectedObject.type === 'block') {
      const b = state.selectedObject.ref;
      state.selectedObject.bounds = { x: b.x, y: b.y, w: b.width || 300, h: b.height || 120 };
      state.selectedObject.locked = !!b.locked;
    }

    const b = state.selectedObject.bounds;
    selectionBox.style.left = `${b.x}px`;
    selectionBox.style.top = `${b.y}px`;
    selectionBox.style.width = `${b.w}px`;
    selectionBox.style.height = `${b.h}px`;

    const isLocked = !!state.selectedObject.locked;
    selectionBox.classList.toggle('locked', isLocked);

    if (selLockIcon) {
      selLockIcon.className = isLocked ? 'fas fa-lock' : 'fas fa-unlock';
    }
    if (selLockBtn) {
      selLockBtn.title = isLocked ? 'Unlock Object' : 'Lock Object';
    }
  }

  function startSelectionDrag(mode, e) {
    if (!state.selectedObject || state.selectedObject.locked) return;

    const coords = getCanvasCoords(e);
    state.selectionDragMode = mode;
    state.dragInitialState = {
      startCanvasX: coords.x,
      startCanvasY: coords.y,
      clientX: e.clientX,
      clientY: e.clientY,
      bounds: { ...state.selectedObject.bounds },
      aspect: state.selectedObject.bounds.w / (state.selectedObject.bounds.h || 1)
    };

    window.addEventListener('pointermove', onSelectionWindowPointerMove, { passive: false });
    window.addEventListener('pointerup', onSelectionWindowPointerUp);
    window.addEventListener('pointercancel', onSelectionWindowPointerUp);
  }

  function onSelectionWindowPointerMove(e) {
    if (!state.selectionDragMode || !state.selectedObject || !state.dragInitialState) return;
    e.preventDefault();
    handleSelectionDragMove(e);
  }

  function onSelectionWindowPointerUp(e) {
    window.removeEventListener('pointermove', onSelectionWindowPointerMove);
    window.removeEventListener('pointerup', onSelectionWindowPointerUp);
    window.removeEventListener('pointercancel', onSelectionWindowPointerUp);

    if (state.selectionDragMode) {
      handleSelectionDragEnd(e);
    }
  }

  function handleSelectionDragMove(e) {
    if (!state.selectedObject || !state.selectionDragMode || !state.dragInitialState) return;
    if (state.selectedObject.locked) return;

    const curCoords = getCanvasCoords(e);
    const dx = curCoords.x - state.dragInitialState.startCanvasX;
    const dy = curCoords.y - state.dragInitialState.startCanvasY;
    const initB = state.dragInitialState.bounds;
    const minSize = 40;

    if (state.selectionDragMode === 'move') {
      const newX = Math.round(initB.x + dx);
      const newY = Math.round(initB.y + dy);

      if (state.selectedObject.type === 'image') {
        state.selectedObject.ref.x = newX;
        state.selectedObject.ref.y = newY;
        redrawImageCanvas();
      } else if (state.selectedObject.type === 'pdf') {
        if (state.pdfMaterialTransform) {
          state.pdfMaterialTransform.x = newX;
          state.pdfMaterialTransform.y = newY;
          redrawPdfCanvas();
        }
      } else if (state.selectedObject.type === 'block') {
        state.selectedObject.ref.x = newX;
        state.selectedObject.ref.y = newY;
        const el = document.getElementById(state.selectedObject.ref.id) || document.getElementById('vff_block_' + state.selectedObject.ref.id);
        if (el) {
          el.style.left = `${newX}px`;
          el.style.top = `${newY}px`;
        }
        markRecordingDirty();
      }

      updateSelectionOverlay();
      return;
    }

    // Handle Resizing (8 handles: nw, n, ne, e, se, s, sw, w)
    let newX = initB.x;
    let newY = initB.y;
    let newW = initB.w;
    let newH = initB.h;
    const aspect = state.dragInitialState.aspect || 1;
    const isAspectPreserved = state.selectedObject.type === 'image' || state.selectedObject.type === 'pdf';

    switch (state.selectionDragMode) {
      case 'resize-se':
        newW = Math.max(minSize, initB.w + dx);
        newH = isAspectPreserved ? Math.round(newW / aspect) : Math.max(minSize, initB.h + dy);
        break;
      case 'resize-e':
        newW = Math.max(minSize, initB.w + dx);
        break;
      case 'resize-s':
        newH = Math.max(minSize, initB.h + dy);
        break;
      case 'resize-sw':
        newW = Math.max(minSize, initB.w - dx);
        newH = isAspectPreserved ? Math.round(newW / aspect) : Math.max(minSize, initB.h + dy);
        newX = initB.x + (initB.w - newW);
        break;
      case 'resize-w':
        newW = Math.max(minSize, initB.w - dx);
        newX = initB.x + (initB.w - newW);
        break;
      case 'resize-ne':
        newW = Math.max(minSize, initB.w + dx);
        newH = isAspectPreserved ? Math.round(newW / aspect) : Math.max(minSize, initB.h - dy);
        newY = initB.y + (initB.h - newH);
        break;
      case 'resize-nw':
        newW = Math.max(minSize, initB.w - dx);
        newH = isAspectPreserved ? Math.round(newW / aspect) : Math.max(minSize, initB.h - dy);
        newX = initB.x + (initB.w - newW);
        newY = initB.y + (initB.h - newH);
        break;
      case 'resize-n':
        newH = Math.max(minSize, initB.h - dy);
        newY = initB.y + (initB.h - newH);
        break;
    }

    // Apply new dimensions to underlying data model
    if (state.selectedObject.type === 'image') {
      state.selectedObject.ref.x = newX;
      state.selectedObject.ref.y = newY;
      state.selectedObject.ref.w = newW;
      state.selectedObject.ref.h = newH;
      redrawImageCanvas();
    } else if (state.selectedObject.type === 'pdf') {
      if (state.pdfMaterialTransform) {
        state.pdfMaterialTransform.x = newX;
        state.pdfMaterialTransform.y = newY;
        state.pdfMaterialTransform.width = newW;
        state.pdfMaterialTransform.height = newH;
        redrawPdfCanvas();
      }
    } else if (state.selectedObject.type === 'block') {
      state.selectedObject.ref.x = newX;
      state.selectedObject.ref.y = newY;
      state.selectedObject.ref.width = newW;
      state.selectedObject.ref.height = newH;
      const el = document.getElementById(state.selectedObject.ref.id) || document.getElementById('vff_block_' + state.selectedObject.ref.id);
      if (el) {
        el.style.left = `${newX}px`;
        el.style.top = `${newY}px`;
        el.style.width = `${newW}px`;
        el.style.height = `${newH}px`;
      }
    }

    updateSelectionOverlay();
  }

  function handleSelectionDragEnd(e) {
    if (!state.selectedObject || !state.selectionDragMode) return;

    const dragMode = state.selectionDragMode;
    const initB = state.dragInitialState ? state.dragInitialState.bounds : null;
    state.selectionDragMode = null;
    state.dragInitialState = null;

    // Check if object actually moved or resized
    const curB = state.selectedObject.bounds;
    const changed = !initB || (initB.x !== curB.x || initB.y !== curB.y || initB.w !== curB.w || initB.h !== curB.h);

    if (changed) {
      saveState();
      if (PedagogicalSignal && typeof PedagogicalSignal.record === 'function') {
        PedagogicalSignal.record(dragMode === 'move' ? 'object_moved' : 'object_resized', { type: state.selectedObject.type });
      }
    }
  }

  function duplicateSelectedObject() {
    if (!state.selectedObject || state.selectedObject.locked) return;

    if (state.selectedObject.type === 'image') {
      const orig = state.selectedObject.ref;
      const copy = {
        id: 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        img: orig.img,
        x: orig.x + 24,
        y: orig.y + 24,
        w: orig.w,
        h: orig.h,
        locked: false
      };
      state.loadedImages.push(copy);
      redrawImageCanvas();
      selectObject({
        type: 'image',
        id: copy.id,
        ref: copy,
        bounds: { x: copy.x, y: copy.y, w: copy.w, h: copy.h },
        locked: false
      });
      saveState();
      if (PedagogicalSignal && typeof PedagogicalSignal.record === 'function') {
        PedagogicalSignal.record('object_duplicated', { type: 'image' });
      }
    } else if (state.selectedObject.type === 'block') {
      duplicateBlock(state.selectedObject.ref.id);
      saveState();
    }
  }

  function deleteSelectedObject() {
    if (!state.selectedObject || state.selectedObject.locked) return;

    const targetType = state.selectedObject.type;
    const targetId = state.selectedObject.id;

    if (targetType === 'image') {
      state.loadedImages = state.loadedImages.filter(i => i.id !== targetId);
      redrawImageCanvas();
      deselectObject();
      saveState();
    } else if (targetType === 'pdf') {
      state.pdfLoaded = false;
      state.pdfDoc = null;
      state.currentPdfPageCanvas = null;
      state.pdfMaterialTransform = null;
      if (pdfCtx && pdfCanvas) {
        pdfCtx.save();
        pdfCtx.setTransform(1, 0, 0, 1, 0, 0);
        pdfCtx.clearRect(0, 0, pdfCanvas.width, pdfCanvas.height);
        pdfCtx.restore();
      }
      updateDocumentHeaderInfo();
      deselectObject();
      saveState();
    } else if (targetType === 'block') {
      deleteBlock(targetId);
      deselectObject();
      saveState();
    }

    if (PedagogicalSignal && typeof PedagogicalSignal.record === 'function') {
      PedagogicalSignal.record('object_deleted', { type: targetType });
    }
  }

  function toggleLockSelectedObject() {
    if (!state.selectedObject) return;

    const newLock = !state.selectedObject.locked;
    state.selectedObject.locked = newLock;

    if (state.selectedObject.type === 'image') {
      state.selectedObject.ref.locked = newLock;
    } else if (state.selectedObject.type === 'pdf') {
      if (state.pdfMaterialTransform) state.pdfMaterialTransform.locked = newLock;
    } else if (state.selectedObject.type === 'block') {
      state.selectedObject.ref.locked = newLock;
    }

    updateSelectionOverlay();
    saveState();
  }

  function bringForwardSelectedObject() {
    if (!state.selectedObject || state.selectedObject.locked) return;

    if (state.selectedObject.type === 'image') {
      const idx = state.loadedImages.findIndex(i => i.id === state.selectedObject.id);
      if (idx !== -1 && idx < state.loadedImages.length - 1) {
        const item = state.loadedImages.splice(idx, 1)[0];
        state.loadedImages.splice(idx + 1, 0, item);
        redrawImageCanvas();
        saveState();
      }
    } else if (state.selectedObject.type === 'block') {
      const idx = state.lessonBlocks.findIndex(b => b.id === state.selectedObject.id);
      if (idx !== -1 && idx < state.lessonBlocks.length - 1) {
        const item = state.lessonBlocks.splice(idx, 1)[0];
        state.lessonBlocks.splice(idx + 1, 0, item);
        renderBlocksDOM();
        saveState();
      }
    }
  }

  function sendBackSelectedObject() {
    if (!state.selectedObject || state.selectedObject.locked) return;

    if (state.selectedObject.type === 'image') {
      const idx = state.loadedImages.findIndex(i => i.id === state.selectedObject.id);
      if (idx > 0) {
        const item = state.loadedImages.splice(idx, 1)[0];
        state.loadedImages.splice(idx - 1, 0, item);
        redrawImageCanvas();
        saveState();
      }
    } else if (state.selectedObject.type === 'block') {
      const idx = state.lessonBlocks.findIndex(b => b.id === state.selectedObject.id);
      if (idx > 0) {
        const item = state.lessonBlocks.splice(idx, 1)[0];
        state.lessonBlocks.splice(idx - 1, 0, item);
        renderBlocksDOM();
        saveState();
      }
    }
  }

  function toggleShapesPopover(force) {
    const open = force !== undefined ? force : !state.isShapesPopoverOpen;
    state.isShapesPopoverOpen = open;
    if (shapesPopover) shapesPopover.classList.toggle('active', open);
    if (shapesBtn) shapesBtn.classList.toggle('active', open);
    if (open) toggleMathPopover(false);
  }

  function toggleMathPopover(force) {
    const open = force !== undefined ? force : !state.isMathPopoverOpen;
    state.isMathPopoverOpen = open;
    if (mathPopover) mathPopover.classList.toggle('active', open);
    if (mathBtn) mathBtn.classList.toggle('active', open);
    if (open) toggleShapesPopover(false);
  }

  /* ============================================================
     DIRECT-ON-CANVAS TEXT TOOL (NO DIALOG, NO POPUP, NO BORDER)
     ============================================================ */
  function setupDirectTextInput() {
    if (!directText) return;

    directText.addEventListener('pointerdown', (e) => e.stopPropagation());
    directText.addEventListener('mousedown', (e) => e.stopPropagation());
    directText.addEventListener('touchstart', (e) => e.stopPropagation());

    directText.addEventListener('input', autoSizeDirectText);

    directText.addEventListener('keydown', (e) => {
      e.stopPropagation();

      if (e.key === 'Escape') {
        e.preventDefault();
        cancelDirectText();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        commitDirectText();
      } else if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
        // Default behavior adds newline; adjust height immediately
        setTimeout(autoSizeDirectText, 10);
      }
    });

    directText.addEventListener('blur', () => {
      setTimeout(() => {
        if (state.isEditingText) {
          commitDirectText();
        }
      }, 80);
    });
  }

  function startDirectText(rawX, rawY, canvasX, canvasY) {
    if (!directText || !canvasContainer) return;

    state.isEditingText = true;
    state.activeTextPos = { rawX, rawY, canvasX, canvasY };

    const maxLeft = canvasContainer.clientWidth - 120;
    const maxTop = canvasContainer.clientHeight - 60;
    const leftPos = Math.max(8, Math.min(rawX, maxLeft));
    const topPos = Math.max(8, Math.min(rawY, maxTop));

    directText.value = '';
    directText.style.display = 'block';
    directText.style.left = leftPos + 'px';
    directText.style.top = topPos + 'px';
    directText.style.fontSize = state.fontSize + 'px';
    directText.style.fontFamily = state.fontFamily;
    directText.style.color = state.strokeColor;
    directText.style.caretColor = state.strokeColor;
    directText.style.width = '120px';
    directText.style.height = (state.fontSize * 1.4) + 'px';

    setTimeout(() => {
      directText.focus();
    }, 15);
  }

  function autoSizeDirectText() {
    if (!directText) return;
    directText.style.height = 'auto';
    directText.style.height = Math.max(state.fontSize * 1.4, directText.scrollHeight) + 'px';
    directText.style.width = 'auto';
    directText.style.width = Math.max(120, directText.scrollWidth + 16) + 'px';
  }

  function commitDirectText() {
    if (!state.isEditingText || !state.activeTextPos) return;
    markRecordingDirty();

    const text = directText.value;
    directText.style.display = 'none';
    directText.value = '';
    state.isEditingText = false;

    if (text && text.trim().length > 0) {
      const dpr = window.devicePixelRatio || 1;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.font = `600 ${state.fontSize}px ${state.fontFamily}`;
      ctx.fillStyle = state.strokeColor;
      ctx.textBaseline = 'top';

      const lines = text.split('\n');
      const lineHeight = state.fontSize * 1.3;
      lines.forEach((line, index) => {
        ctx.fillText(line, state.activeTextPos.canvasX, state.activeTextPos.canvasY + index * lineHeight);
      });

      ctx.restore();
      saveState();
      TeachingSession.logAction('whiteboard_text_add', { tool: 'text' });
    }

    state.activeTextPos = null;
  }

  function cancelDirectText() {
    if (directText) {
      directText.style.display = 'none';
      directText.value = '';
    }
    state.isEditingText = false;
    state.activeTextPos = null;
  }

  /* ============================================================
     KEYBOARD SHORTCUTS & ROBUST ESCAPE HANDLER
     Handles:
     - Escape: Immediately exits Presentation Mode, closes tool panel,
               or cancels active text editing.
     - PDF Navigation: ArrowLeft/Right, ArrowUp/Down, PageUp/Down, Home, End.
     ============================================================ */
  function setupKeyboardShortcuts() {
    // Capture-phase listener guarantees ESC is NEVER blocked or lost
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.code === 'Escape' || e.keyCode === 27) {
        // Priority 1: Cancel active text typing if in progress
        if (state.isEditingText) {
          cancelDirectText();
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        // Priority 1.5: Deselect Teaching Object or close Popovers
        if (state.selectedObject) {
          deselectObject();
          toggleShapesPopover(false);
          toggleMathPopover(false);
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (state.isShapesPopoverOpen) {
          toggleShapesPopover(false);
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (state.isMathPopoverOpen) {
          toggleMathPopover(false);
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        // Priority 2: Close Subject Switcher Dropdown if open
        const subjectDropdownMenu = document.getElementById('wbSubjectDropdownMenu');
        if (subjectDropdownMenu && subjectDropdownMenu.style.display !== 'none') {
          toggleSubjectDropdown(false);
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        // Priority 3: Close Presentation Quick Actions if open
        if (state.isPresQuickActionsOpen) {
          togglePresQuickActions(false);
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        // Priority 4: Close Normal Quick Actions if open
        if (state.isQuickActionsOpen) {
          toggleQuickActions(false);
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        // Priority 5: Close Presentation Background Menu if open
        if (state.isPresBgMenuOpen) {
          togglePresBgMenu(false);
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        // Priority 6: Close Assets Drawer if open
        if (state.isAssetsDrawerOpen) {
          toggleAssetsDrawer(false);
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        // Priority 7: Close Presentation Tool Panel if open
        if (state.isPresToolPanelOpen) {
          togglePresToolPanel(false);
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        // Priority 8: Close Subject Drawer if open
        if (state.isSubjectDrawerOpen) {
          toggleSubjectDrawer(false);
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        // Priority 7: Turn off Spotlight if active
        if (state.isSpotlightActive) {
          toggleSpotlight(false);
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        // Priority 8: Turn off Laser if active
        if (state.isLaserActive) {
          toggleLaser(false);
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        // Priority 9: Exit Presentation Mode immediately
        if (state.isPresentationMode) {
          e.preventDefault();
          e.stopPropagation();
          togglePresentationMode(false);
          return;
        }
      }

      // Check if user is typing in an input, textarea, or contentEditable element
      const activeEl = document.activeElement;
      const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);
      if (isInput || state.isEditingText) return;

      // Global Undo / Redo Shortcuts (Ctrl+Z, Cmd+Z, Ctrl+Y, Cmd+Y, Ctrl+Shift+Z)
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        if (e.key === 'z' || e.key === 'Z') {
          e.preventDefault();
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
          return;
        }
        if (e.key === 'y' || e.key === 'Y') {
          e.preventDefault();
          redo();
          return;
        }
      }

      // Delete / Backspace (Delete selected teaching object)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (state.selectedObject && !state.isEditingText) {
          e.preventDefault();
          deleteSelectedObject();
          return;
        }
      }

      // Duplicate Selected Teaching Object (Ctrl+D / Cmd+D)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
        if (state.selectedObject && !state.isEditingText) {
          e.preventDefault();
          duplicateSelectedObject();
          return;
        }
      }

      // Spacebar Temporary Hold-to-Pan (Phase 2.5)
      if ((e.code === 'Space' || e.key === ' ') && !state.isSpaceDown && !e.ctrlKey && !e.metaKey && !e.altKey) {
        state.isSpaceDown = true;
        state.previousToolBeforeSpace = state.currentTool;
        selectTool('pan');
        e.preventDefault();
        return;
      }

      // Single-key Tool Shortcuts (When not typing or using modifier keys)
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const key = e.key.toLowerCase();
        if (key === 'v') { selectTool('select'); e.preventDefault(); return; }
        else if (key === 'p' || key === 'b') { selectTool('pen'); e.preventDefault(); return; }
        else if (key === 'h') { selectTool('highlighter'); e.preventDefault(); return; }
        else if (key === 'e') { selectTool('eraser'); e.preventDefault(); return; }
        else if (key === 't') { selectTool('text'); e.preventDefault(); return; }
        else if (key === 'l') { selectTool('line'); e.preventDefault(); return; }
        else if (key === 'a') { selectTool('arrow'); e.preventDefault(); return; }
        else if (key === 'r') { selectTool('rectangle'); e.preventDefault(); return; }
        else if (key === 'c') { selectTool('circle'); e.preventDefault(); return; }
        else if (key === 'm') { selectTool('ruler'); e.preventDefault(); return; }
      }

      // PDF Multi-Page Keyboard Navigation
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (!state.pdfLoaded || !state.pdfDoc) return;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        nextPdfPage();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        prevPdfPage();
      } else if (e.key === 'Home') {
        e.preventDefault();
        firstPdfPage();
      } else if (e.key === 'End') {
        e.preventDefault();
        lastPdfPage();
      }
    }, true);

    // Restore tool when space key is released
    window.addEventListener('keyup', (e) => {
      if ((e.code === 'Space' || e.key === ' ') && state.isSpaceDown) {
        state.isSpaceDown = false;
        if (state.previousToolBeforeSpace) {
          selectTool(state.previousToolBeforeSpace);
          state.previousToolBeforeSpace = null;
        }
        e.preventDefault();
      }
    }, true);

    // Window blur safety to guarantee pan state is never stuck
    window.addEventListener('blur', () => {
      if (state.isSpaceDown) {
        state.isSpaceDown = false;
        if (state.previousToolBeforeSpace) {
          selectTool(state.previousToolBeforeSpace);
          state.previousToolBeforeSpace = null;
        }
      }
    });
  }

  /* ============================================================
     SUBJECT TEACHING MODES & MODERN APP SWITCHER
     (General, Mathematics, Science, English, Public Speaking)
     ============================================================ */
  const SUBJECT_METADATA = {
    general: {
      name: 'General Teaching',
      sub: 'Universal classroom studio',
      icon: '<i class="fas fa-chalkboard-teacher"></i>',
      bg: 'rgba(37,99,235,0.12)',
      color: '#2563eb'
    },
    math: {
      name: 'Mathematics',
      sub: 'Numbers, geometry & problem solving',
      icon: '<i class="fas fa-square-root-alt"></i>',
      bg: 'rgba(16,185,129,0.12)',
      color: '#10b981'
    },
    science: {
      name: 'Science Studio',
      sub: 'Diagrams, observations & concepts',
      icon: '<i class="fas fa-flask"></i>',
      bg: 'rgba(14,165,233,0.12)',
      color: '#0ea5e9'
    },
    english: {
      name: 'English & Grammar',
      sub: 'Writing, grammar & vocabulary',
      icon: '<i class="fas fa-book-open"></i>',
      bg: 'rgba(99,102,241,0.12)',
      color: '#6366f1'
    },
    speech: {
      name: 'Public Speaking & Debate',
      sub: 'Speech, debate & presentation',
      icon: '<i class="fas fa-microphone-alt"></i>',
      bg: 'rgba(245,158,11,0.12)',
      color: '#f59e0b'
    }
  };

  function setSubjectMode(mode) {
    state.subjectMode = mode;
    TeachingSession.logAction('subject_mode_change', { mode });
    PedagogicalSignal.record('subject_mode_change', { mode });

    // Set standard default background for selected subject
    if (mode === 'math') {
      setGridBackground('coord');
    } else if (mode === 'science') {
      setGridBackground('table');
    } else if (mode === 'english') {
      setGridBackground('lines');
    } else if (mode === 'speech') {
      setGridBackground('speech');
    } else {
      setGridBackground('dots');
    }

    // Update Custom Subject Switcher UI
    const meta = SUBJECT_METADATA[mode] || SUBJECT_METADATA.general;
    const currentIcon = document.getElementById('wbSubjectCurrentIcon');
    const currentLabel = document.getElementById('wbSubjectCurrentLabel');
    const currentSub = document.getElementById('wbSubjectCurrentSub');
    if (currentIcon) {
      currentIcon.innerHTML = meta.icon;
      currentIcon.style.background = meta.bg;
      currentIcon.style.color = meta.color;
    }
    if (currentLabel) currentLabel.textContent = meta.name;
    if (currentSub) currentSub.textContent = meta.sub;

    // Update active state in custom dropdown options
    const options = document.querySelectorAll('.wb-subject-option');
    options.forEach((opt) => {
      if (opt.getAttribute('data-subject') === mode) {
        opt.classList.add('active');
      } else {
        opt.classList.remove('active');
      }
    });

    // Synchronize preserved native select
    if (subjectSelect && subjectSelect.value !== mode) {
      subjectSelect.value = mode;
    }

    updateDocumentHeaderInfo();
    updateSubjectToolsDrawer(mode);
    updateAdRailFallback();
  }

  function toggleSubjectDropdown(open) {
    const menu = document.getElementById('wbSubjectDropdownMenu');
    const trigger = document.getElementById('wbSubjectSwitcherBtn');
    const wrapper = document.getElementById('wbSubjectSwitcherWrapper');
    if (!menu) return;
    if (open === undefined) {
      open = menu.style.display === 'none' || !menu.style.display;
    }
    menu.style.display = open ? 'flex' : 'none';
    if (trigger) {
      trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    if (wrapper) {
      if (open) wrapper.classList.add('open');
      else wrapper.classList.remove('open');
    }
  }

  function updateSubjectToolsDrawer(mode) {
    if (!subjectDrawer) return;

    let html = '';
    if (mode === 'math') {
      html = `
        <div class="wb-drawer-title"><i class="fas fa-square-root-alt" style="color: #2563eb;"></i> Mathematics Teaching Studio</div>
        <div class="wb-drawer-grid">
          <button type="button" class="wb-drawer-btn" onclick="VFFWhiteboard.setGridBackground('coord')"><i class="fas fa-arrows-alt"></i> X-Y Coordinate Plane</button>
          <button type="button" class="wb-drawer-btn" onclick="VFFWhiteboard.setGridBackground('numline')"><i class="fas fa-ruler-horizontal"></i> Centered Number Line (-10 to +10)</button>
          <button type="button" class="wb-drawer-btn" onclick="VFFWhiteboard.setGridBackground('math')"><i class="fas fa-border-all"></i> Math Grid (24px)</button>
          <button type="button" class="wb-drawer-btn" onclick="VFFWhiteboard.setGridBackground('graph')"><i class="fas fa-th"></i> Fine Graph Paper (14px)</button>
          <button type="button" class="wb-drawer-btn" onclick="VFFWhiteboard.loadTeachingTemplate('fractions'); VFFWhiteboard.toggleSubjectDrawer(false);"><i class="fas fa-chart-pie" style="color: #2563eb;"></i> Fraction Comparison Bars</button>
          <button type="button" class="wb-drawer-btn" onclick="VFFWhiteboard.loadTeachingTemplate('coord_plane'); VFFWhiteboard.toggleSubjectDrawer(false);"><i class="fas fa-shapes" style="color: #10b981;"></i> Geometry Workspace</button>
          <button type="button" class="wb-drawer-btn" onclick="VFFWhiteboard.selectTool('triangle')"><i class="fas fa-play" style="transform: rotate(-90deg);"></i> Geometry Triangle</button>
          <button type="button" class="wb-drawer-btn" onclick="VFFWhiteboard.selectTool('ruler')"><i class="fas fa-ruler"></i> Measurement Ruler</button>
          <button type="button" class="wb-drawer-btn" onclick="VFFWhiteboard.setGridBackground('blank')"><i class="far fa-file"></i> Clean White Board</button>
        </div>
      `;
    } else if (mode === 'science') {
      html = `
        <div class="wb-drawer-title"><i class="fas fa-flask" style="color: #10b981;"></i> Science Teaching Studio</div>
        <div class="wb-drawer-grid">
          <button type="button" class="wb-drawer-btn" onclick="VFFWhiteboard.setGridBackground('table')"><i class="fas fa-table"></i> Science Observation Table</button>
          <button type="button" class="wb-drawer-btn" onclick="VFFWhiteboard.loadTeachingTemplate('water_cycle'); VFFWhiteboard.toggleSubjectDrawer(false);"><i class="fas fa-cloud-rain" style="color: #0ea5e9;"></i> Water Cycle Template</button>
          <button type="button" class="wb-drawer-btn" onclick="VFFWhiteboard.loadTeachingTemplate('plant_cell'); VFFWhiteboard.toggleSubjectDrawer(false);"><i class="fas fa-dna" style="color: #10b981;"></i> Plant Cell Diagram</button>
          <button type="button" class="wb-drawer-btn" onclick="VFFWhiteboard.loadTeachingTemplate('science_obs'); VFFWhiteboard.toggleSubjectDrawer(false);"><i class="fas fa-clipboard-list" style="color: #8b5cf6;"></i> Experiment Sheet</button>
          <button type="button" class="wb-drawer-btn" onclick="VFFWhiteboard.selectTool('arrow')"><i class="fas fa-long-arrow-alt-right"></i> Diagram Label Callout Arrow</button>
          <button type="button" class="wb-drawer-btn" onclick="VFFWhiteboard.selectTool('rectangle')"><i class="far fa-square"></i> Specimen Observation Box</button>
          <button type="button" class="wb-drawer-btn" onclick="VFFWhiteboard.selectTool('circle')"><i class="far fa-circle"></i> Biological Cell / Circle</button>
          <button type="button" class="wb-drawer-btn" onclick="VFFWhiteboard.setGridBackground('dots')"><i class="fas fa-braille"></i> Diagram Alignment Grid</button>
        </div>
      `;
    } else if (mode === 'english') {
      html = `
        <div class="wb-drawer-title"><i class="fas fa-book-open" style="color: #6366f1;"></i> English Language & Grammar</div>
        <div class="wb-drawer-grid">
          <button type="button" class="wb-drawer-btn" onclick="VFFWhiteboard.setGridBackground('lines')"><i class="fas fa-align-justify"></i> Ruled Writing Lines (32px)</button>
          <button type="button" class="wb-drawer-btn" onclick="VFFWhiteboard.loadTeachingTemplate('vocab_matrix'); VFFWhiteboard.toggleSubjectDrawer(false);"><i class="fas fa-table" style="color: #6366f1;"></i> Vocabulary Matrix</button>
          <button type="button" class="wb-drawer-btn" onclick="VFFWhiteboard.loadTeachingTemplate('reading_comp'); VFFWhiteboard.toggleSubjectDrawer(false);"><i class="fas fa-book-reader" style="color: #2563eb;"></i> Reading Comprehension</button>
          <button type="button" class="wb-drawer-btn" onclick="VFFWhiteboard.selectTool('text')"><i class="fas fa-font"></i> Paragraph / Sentence Text</button>
          <button type="button" class="wb-drawer-btn" onclick="VFFWhiteboard.selectTool('highlighter')"><i class="fas fa-highlighter"></i> Vocabulary Highlighter</button>
          <button type="button" class="wb-drawer-btn" onclick="VFFWhiteboard.setGridBackground('blank')"><i class="far fa-file"></i> Clean Composition Page</button>
        </div>
      `;
    } else if (mode === 'speech') {
      html = `
        <div class="wb-drawer-title"><i class="fas fa-microphone-alt" style="color: #f59e0b;"></i> Public Speaking & Debate</div>
        <div class="wb-drawer-grid">
          <button type="button" class="wb-drawer-btn" onclick="VFFWhiteboard.setGridBackground('speech')"><i class="fas fa-columns"></i> Speech Outline (Hook→Body→Call)</button>
          <button type="button" class="wb-drawer-btn" onclick="VFFWhiteboard.loadTeachingTemplate('speech_outline'); VFFWhiteboard.toggleSubjectDrawer(false);"><i class="fas fa-microphone" style="color: #f59e0b;"></i> 3-Part Speech Structure</button>
          <button type="button" class="wb-drawer-btn" onclick="VFFWhiteboard.loadTeachingTemplate('cue_cards'); VFFWhiteboard.toggleSubjectDrawer(false);"><i class="fas fa-id-card" style="color: #10b981;"></i> Presenter Cue Cards</button>
          <button type="button" class="wb-drawer-btn" onclick="VFFWhiteboard.selectTool('text')"><i class="fas fa-font"></i> Bullet Point Outlining</button>
          <button type="button" class="wb-drawer-btn" onclick="VFFWhiteboard.selectTool('arrow')"><i class="fas fa-long-arrow-alt-right"></i> Argument Flow Arrow</button>
          <button type="button" class="wb-drawer-btn" onclick="VFFWhiteboard.setGridBackground('blank')"><i class="far fa-sticky-note"></i> Cue Cards Presentation Board</button>
        </div>
      `;
    } else {
      html = `
        <div class="wb-drawer-title"><i class="fas fa-layer-group" style="color: #2563eb;"></i> General Teaching Studio</div>
        <div class="wb-drawer-grid">
          <button type="button" class="wb-drawer-btn" onclick="VFFWhiteboard.setGridBackground('dots')"><i class="fas fa-braille"></i> Dot Grid</button>
          <button type="button" class="wb-drawer-btn" onclick="VFFWhiteboard.setGridBackground('math')"><i class="fas fa-border-all"></i> Grid Surface</button>
          <button type="button" class="wb-drawer-btn" onclick="VFFWhiteboard.setGridBackground('lines')"><i class="fas fa-align-justify"></i> Ruled Lines</button>
          <button type="button" class="wb-drawer-btn" onclick="VFFWhiteboard.addLessonBlock('reveal'); VFFWhiteboard.toggleSubjectDrawer(false);"><i class="fas fa-eye-slash" style="color: #2563eb;"></i> Question + Reveal Card</button>
          <button type="button" class="wb-drawer-btn" onclick="VFFWhiteboard.addLessonBlock('note', { color: 'yellow' }); VFFWhiteboard.toggleSubjectDrawer(false);"><i class="fas fa-sticky-note" style="color: #f59e0b;"></i> Sticky Thought Note</button>
          <button type="button" class="wb-drawer-btn" onclick="VFFWhiteboard.setGridBackground('blank')"><i class="far fa-file"></i> Blank White</button>
        </div>
      `;
    }

    subjectDrawer.innerHTML = html;
  }

  function toggleSubjectDrawer(open) {
    if (!subjectDrawer) return;
    if (open === undefined) {
      open = !state.isSubjectDrawerOpen;
    }
    state.isSubjectDrawerOpen = open;
    subjectDrawer.style.display = state.isSubjectDrawerOpen ? 'block' : 'none';
    if (state.isSubjectDrawerOpen && state.isAssetsDrawerOpen) {
      toggleAssetsDrawer(false);
    }
  }

  /* ============================================================
     PHASE 2: TEACHING ANNOTATION STAMPS REGISTRY
     ============================================================ */
  const ANNOTATION_ITEMS = [
    // Classroom
    { id: 'important', icon: '⭐', text: 'Important', cat: 'classroom', color: '#ef4444' },
    { id: 'key_idea', icon: '💡', text: 'Key Idea', cat: 'classroom', color: '#f59e0b' },
    { id: 'think_first', icon: '🤔', text: 'Think First', cat: 'classroom', color: '#8b5cf6' },
    { id: 'question', icon: '❓', text: 'Question', cat: 'classroom', color: '#2563eb' },
    { id: 'remember', icon: '📝', text: 'Remember', cat: 'classroom', color: '#0ea5e9' },
    { id: 'observe', icon: '🔍', text: 'Look Closely', cat: 'classroom', color: '#10b981' },
    { id: 'goal', icon: '🎯', text: 'Learning Goal', cat: 'classroom', color: '#ec4899' },
    { id: 'example', icon: '💡', text: 'Example', cat: 'classroom', color: '#6366f1' },
    { id: 'practice', icon: '✍️', text: 'Practice', cat: 'classroom', color: '#14b8a6' },
    { id: 'challenge', icon: '🔥', text: 'Challenge', cat: 'classroom', color: '#f97316' },
    { id: 'good_job', icon: '👍', text: 'Good Job', cat: 'classroom', color: '#16a34a' },
    { id: 'excellent', icon: '👏', text: 'Excellent', cat: 'classroom', color: '#059669' },
    { id: 'correct', icon: '✅', text: 'Correct', cat: 'classroom', color: '#16a34a' },
    { id: 'check_again', icon: '❌', text: 'Check Again', cat: 'classroom', color: '#dc2626' },
    { id: 'warning', icon: '⚠️', text: 'Warning', cat: 'classroom', color: '#ef4444' },
    { id: 'ask', icon: '🙋', text: 'Ask Question', cat: 'classroom', color: '#0ea5e9' },
    { id: 'try_again', icon: '🔄', text: 'Try Again', cat: 'classroom', color: '#f59e0b' },

    // Teaching Actions
    { id: 'think', icon: '💭', text: 'Think', cat: 'actions', color: '#8b5cf6' },
    { id: 'discuss', icon: '🗣️', text: 'Discuss', cat: 'actions', color: '#2563eb' },
    { id: 'explain', icon: '💡', text: 'Explain', cat: 'actions', color: '#f59e0b' },
    { id: 'compare', icon: '⚖️', text: 'Compare', cat: 'actions', color: '#0ea5e9' },
    { id: 'predict', icon: '🔮', text: 'Predict', cat: 'actions', color: '#ec4899' },
    { id: 'find', icon: '🔎', text: 'Find', cat: 'actions', color: '#10b981' },
    { id: 'circle_it', icon: '⭕', text: 'Circle It', cat: 'actions', color: '#ef4444' },
    { id: 'underline_it', icon: '📏', text: 'Underline', cat: 'actions', color: '#6366f1' },
    { id: 'match_it', icon: '🔗', text: 'Match', cat: 'actions', color: '#14b8a6' },
    { id: 'try_it', icon: '🚀', text: 'Try It', cat: 'actions', color: '#f97316' },

    // Maths
    { id: 'math_formula', icon: '📐', text: 'Formula', cat: 'math', color: '#2563eb' },
    { id: 'math_step1', icon: '1️⃣', text: 'Step 1', cat: 'math', color: '#2563eb' },
    { id: 'math_step2', icon: '2️⃣', text: 'Step 2', cat: 'math', color: '#2563eb' },
    { id: 'math_ans', icon: '🎯', text: 'Answer', cat: 'math', color: '#16a34a' },
    { id: 'math_check', icon: '✔️', text: 'Check Result', cat: 'math', color: '#10b981' },
    { id: 'math_ops', icon: '🔢', text: '+ − × ÷', cat: 'math', color: '#0f172a' },
    { id: 'math_sqrt', icon: '√', text: 'Square Root', cat: 'math', color: '#8b5cf6' },
    { id: 'math_frac', icon: '½', text: 'Fraction', cat: 'math', color: '#ca8a04' },
    { id: 'math_geom', icon: '📐', text: 'Angle θ', cat: 'math', color: '#ec4899' },

    // Science
    { id: 'sci_obs', icon: '🔬', text: 'Observe', cat: 'science', color: '#10b981' },
    { id: 'sci_hypo', icon: '🧪', text: 'Hypothesis', cat: 'science', color: '#8b5cf6' },
    { id: 'sci_exp', icon: '⚙️', text: 'Experiment', cat: 'science', color: '#2563eb' },
    { id: 'sci_res', icon: '📊', text: 'Result', cat: 'science', color: '#f59e0b' },
    { id: 'sci_label', icon: '🏷️', text: 'Label Part', cat: 'science', color: '#0ea5e9' },
    { id: 'sci_evid', icon: '🧬', text: 'Evidence', cat: 'science', color: '#ec4899' },
    { id: 'sci_conc', icon: '📝', text: 'Conclusion', cat: 'science', color: '#16a34a' },
    { id: 'sci_cycle', icon: '🔄', text: 'Life Cycle', cat: 'science', color: '#14b8a6' },

    // English
    { id: 'eng_vocab', icon: '📖', text: 'Vocabulary', cat: 'english', color: '#6366f1' },
    { id: 'eng_gram', icon: '✍️', text: 'Grammar Rule', cat: 'english', color: '#8b5cf6' },
    { id: 'eng_mean', icon: '💡', text: 'Meaning', cat: 'english', color: '#f59e0b' },
    { id: 'eng_ex', icon: '💬', text: 'Example', cat: 'english', color: '#2563eb' },
    { id: 'eng_syn', icon: '🔄', text: 'Synonym', cat: 'english', color: '#10b981' },
    { id: 'eng_ant', icon: '↔️', text: 'Antonym', cat: 'english', color: '#ef4444' },
    { id: 'eng_read', icon: '📖', text: 'Read', cat: 'english', color: '#0ea5e9' },
    { id: 'eng_write', icon: '✍️', text: 'Write', cat: 'english', color: '#14b8a6' },
    { id: 'eng_speak', icon: '🗣️', text: 'Speak', cat: 'english', color: '#ec4899' },
    { id: 'new_word', icon: '🔤', text: 'New Word', cat: 'english', color: '#2563eb' },
    { id: 'correct_sent', icon: '💯', text: 'Correct Sentence', cat: 'english', color: '#16a34a' },

    // Public Speaking
    { id: 'spk_hook', icon: '🎣', text: 'Opening Hook', cat: 'speech', color: '#f59e0b' },
    { id: 'spk_main', icon: '🎯', text: 'Main Point', cat: 'speech', color: '#2563eb' },
    { id: 'spk_evid', icon: '📊', text: 'Evidence', cat: 'speech', color: '#6366f1' },
    { id: 'spk_ex', icon: '💡', text: 'Story / Example', cat: 'speech', color: '#10b981' },
    { id: 'spk_trans', icon: '➡️', text: 'Transition', cat: 'speech', color: '#8b5cf6' },
    { id: 'spk_voice', icon: '🗣️', text: 'Voice Modulation', cat: 'speech', color: '#0ea5e9' },
    { id: 'spk_eye', icon: '👀', text: 'Eye Contact', cat: 'speech', color: '#14b8a6' },
    { id: 'spk_pause', icon: '⏸️', text: 'Strategic Pause', cat: 'speech', color: '#ef4444' },
    { id: 'spk_conc', icon: '🏁', text: 'Conclusion', cat: 'speech', color: '#16a34a' },
    { id: 'spk_moral', icon: '🌟', text: 'Call to Action', cat: 'speech', color: '#ec4899' },
    { id: 'speak_clearly', icon: '🎙️', text: 'Speak Clearly', cat: 'speech', color: '#2563eb' }
  ];

  function stampSticker(stampId, x, y) {
    const item = ANNOTATION_ITEMS.find(a => a.id === stampId) || { icon: '⭐', text: stampId, color: '#2563eb' };
    addLessonBlock('stamp', {
      icon: item.icon,
      text: item.text,
      color: item.color
    }, x, y);
    PedagogicalSignal.record('sticker_stamped', { stampId });
    TeachingSession.logAction('sticker_stamped', { stampId });
  }

  function renderAnnotationsGrid(category) {
    const grid = document.getElementById('wbAnnotationsGrid');
    if (!grid) return;
    const filtered = category === 'all'
      ? ANNOTATION_ITEMS
      : ANNOTATION_ITEMS.filter(a => a.cat === category);

    grid.innerHTML = filtered.map(item => `
      <div class="wb-stamp-chip" onclick="VFFWhiteboard.stampSticker('${item.id}'); VFFWhiteboard.toggleAssetsDrawer(false);" title="Click to place '${item.text}' on board">
        <span class="wb-stamp-icon">${item.icon}</span>
        <span class="wb-stamp-text">${item.text}</span>
      </div>
    `).join('');
  }

  function filterAnnotationCategory(category) {
    state.activeAnnotationCategory = category;
    const pillBtns = document.querySelectorAll('.wb-pill-btn');
    pillBtns.forEach(btn => {
      if (btn.getAttribute('data-category') === category) btn.classList.add('active');
      else btn.classList.remove('active');
    });
    renderAnnotationsGrid(category);
  }

  function toggleAssetsDrawer(open) {
    if (!assetsDrawer) return;
    if (open === undefined) {
      open = !state.isAssetsDrawerOpen;
    }
    state.isAssetsDrawerOpen = open;
    assetsDrawer.style.display = state.isAssetsDrawerOpen ? 'flex' : 'none';

    // Sync active highlight state and aria-expanded on all 4 Assets trigger buttons
    const assetBtnIds = ['wbHeaderAssetsBtn', 'wbToolbarAssetsBtn', 'wbPresHeaderAssetsBtn', 'wbPresAssetsBtn'];
    assetBtnIds.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        if (state.isAssetsDrawerOpen) {
          btn.classList.add('active');
          btn.setAttribute('aria-expanded', 'true');
        } else {
          btn.classList.remove('active');
          btn.setAttribute('aria-expanded', 'false');
        }
      }
    });

    if (state.isAssetsDrawerOpen) {
      if (state.isSubjectDrawerOpen) toggleSubjectDrawer(false);
      if (state.isPresToolPanelOpen) togglePresToolPanel(false);
      if (state.isQuickActionsOpen) toggleQuickActions(false);
    }
    PedagogicalSignal.record('assets_drawer_toggled', { open: state.isAssetsDrawerOpen });
  }

  function switchAssetTab(tabName) {
    state.activeAssetTab = tabName;
    const tabBtns = document.querySelectorAll('.wb-asset-tab');
    tabBtns.forEach(btn => {
      if (btn.getAttribute('data-tab') === tabName) btn.classList.add('active');
      else btn.classList.remove('active');
    });

    const panes = {
      annotations: document.getElementById('wbTabAnnotations'),
      infographics: document.getElementById('wbTabInfographics'),
      templates: document.getElementById('wbTabTemplates'),
      blocks: document.getElementById('wbTabBlocks')
    };
    Object.keys(panes).forEach(k => {
      if (panes[k]) {
        panes[k].style.display = k === tabName ? 'flex' : 'none';
      }
    });
  }

  function toggleQuickActions(open) {
    if (!quickActionsMenu) return;
    if (open === undefined) {
      open = !state.isQuickActionsOpen;
    }
    state.isQuickActionsOpen = open;
    quickActionsMenu.style.display = state.isQuickActionsOpen ? 'flex' : 'none';
  }

  function updateAdRailFallback() {
    const railSubject = document.getElementById('wbRailSubject');
    if (railSubject) {
      const modeNames = {
        general: 'General',
        math: 'Maths',
        science: 'Science',
        english: 'English',
        speech: 'Speech'
      };
      railSubject.textContent = modeNames[state.subjectMode] || 'General';
    }
    const railBlocks = document.getElementById('wbRailBlocks');
    if (railBlocks) {
      railBlocks.textContent = `${state.lessonBlocks.length} Active`;
    }
  }

  /* ============================================================
     PHASE 2: MOVABLE & EDITABLE LESSON BLOCKS ENGINE
     ============================================================ */
  function addLessonBlock(type, customData = {}, x, y) {
    hideEmptyState();

    const dpr = window.devicePixelRatio || 1;
    const canvasCssW = canvas ? canvas.width / dpr : 800;
    const canvasCssH = canvas ? canvas.height / dpr : 600;

    const offset = (state.lessonBlocks.length % 6) * 22;
    const posX = x !== undefined ? x : Math.max(30, Math.min(canvasCssW - 340, canvasCssW * 0.32 + offset));
    const posY = y !== undefined ? y : Math.max(30, Math.min(canvasCssH - 220, canvasCssH * 0.22 + offset));

    let blockData = {};
    let width = 320;
    let height = 140;

    if (type === 'stamp') {
      blockData = {
        icon: customData.icon || '⭐',
        text: customData.text || 'Important',
        color: customData.color || '#2563eb'
      };
      width = 170;
      height = 36;
    } else if (type === 'qa' || type === 'reveal') {
      blockData = {
        question: customData.question || 'Why do leaves change color in autumn?',
        answer: customData.answer || 'Chlorophyll breaks down in cold weather, unmasking golden carotenoid pigments.',
        revealed: customData.revealed || false
      };
      width = 340;
      height = 140;
    } else if (type === 'concept') {
      blockData = {
        title: customData.title || 'KEY CONCEPT',
        body: customData.body || 'Photosynthesis converts light energy, water, and carbon dioxide into glucose and oxygen.'
      };
      width = 300;
      height = 95;
    } else if (type === 'note') {
      blockData = {
        color: customData.color || 'yellow',
        text: customData.text || 'Remember to emphasize the distinction between kinetic and potential energy.'
      };
      width = 210;
      height = 150;
    } else if (type === 'task') {
      blockData = {
        title: customData.title || 'STUDENT PRACTICE',
        items: customData.items || [
          { text: 'Calculate the area of a circle with r = 7 cm', done: false },
          { text: 'Write the formula: A = πr²', done: false },
          { text: 'Substitute values and simplify to final answer', done: false }
        ]
      };
      width = 320;
      height = 145;
    } else if (type === 'example') {
      blockData = {
        title: customData.title || 'MODEL EXAMPLE',
        problem: customData.problem || 'Solve for x: 3x + 5 = 20',
        steps: customData.steps || 'Step 1: Subtract 5 → 3x = 15\nStep 2: Divide by 3 → x = 5'
      };
      width = 330;
      height = 140;
    } else if (type === 'takeaway') {
      blockData = {
        title: customData.title || 'KEY TAKEAWAY',
        text: customData.text || 'Master fundamental principles before applying advanced formulas.'
      };
      width = 300;
      height = 100;
    } else if (type === 'vocab') {
      blockData = {
        word: customData.word || 'Hypothesis',
        pos: customData.pos || 'noun',
        meaning: customData.meaning || 'A proposed explanation made as a starting point for further investigation.',
        example: customData.example || 'The scientist tested her hypothesis with a controlled experiment.'
      };
      width = 320;
      height = 145;
    } else if (type === 'tip') {
      blockData = {
        title: customData.title || 'TEACHER TIP',
        tip: customData.tip || 'Have students verbalize their reasoning before writing the final solution.'
      };
      width = 290;
      height = 105;
    } else if (type === 'definition') {
      blockData = {
        term: customData.term || 'Photosynthesis',
        definition: customData.definition || 'The biochemical process by which green plants synthesize nutrients from carbon dioxide and water using sunlight.'
      };
      width = 320;
      height = 115;
    } else if (type === 'compare_block') {
      blockData = {
        title: customData.title || 'COMPARE & CONTRAST',
        colA: customData.colA || 'Concept A (e.g. Mitosis)\n- 2 identical cells\n- Growth & repair',
        colB: customData.colB || 'Concept B (e.g. Meiosis)\n- 4 unique cells\n- Gamete formation'
      };
      width = 360;
      height = 150;
    } else if (type === 'reminder') {
      blockData = {
        text: customData.text || 'Homework due tomorrow: Page 42, Questions 1-5'
      };
      width = 240;
      height = 65;
    } else if (type === 'infographic') {
      blockData = {
        subType: customData.subType || 'process3',
        title: customData.title || '3-STEP PROCESS',
        nodes: customData.nodes || ['Step 1: Input', 'Step 2: Transform', 'Step 3: Output']
      };
      width = Math.max(360, (customData.nodes ? customData.nodes.length : 3) * 130 + 40);
      height = 110;
    }

    const block = {
      id: 'block_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      type: type === 'reveal' ? 'qa' : type,
      x: Math.round(posX),
      y: Math.round(posY),
      width: width,
      height: height,
      data: blockData
    };

    state.lessonBlocks.push(block);
    renderBlocksDOM();
    saveState();

    PedagogicalSignal.record('lesson_block_created', { type });
    TeachingSession.logAction('lesson_block_created', { type });
    return block;
  }

  function deleteBlock(id) {
    state.lessonBlocks = state.lessonBlocks.filter(b => b.id !== id);
    renderBlocksDOM();
    saveState();
  }

  function duplicateBlock(id) {
    const orig = state.lessonBlocks.find(b => b.id === id);
    if (!orig) return;
    const clone = JSON.parse(JSON.stringify(orig));
    clone.id = 'block_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    clone.x += 20;
    clone.y += 20;
    state.lessonBlocks.push(clone);
    renderBlocksDOM();
    saveState();
  }

  function toggleAnswerReveal(id) {
    const block = state.lessonBlocks.find(b => b.id === id);
    if (!block || block.type !== 'qa') return;
    block.data.revealed = !block.data.revealed;
    renderBlocksDOM();
    saveState();
    PedagogicalSignal.record('answer_revealed', { blockId: id, revealed: block.data.revealed });
    TeachingSession.logAction('answer_revealed', { revealed: block.data.revealed });
  }

  function attachBlockDrag(el, block) {
    const dragHandle = el.querySelector('.wb-block-drag-bar') || el;
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initBlockX = 0;
    let initBlockY = 0;

    function onPointerDown(e) {
      if (e.target.isContentEditable || e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.closest('button')) {
        return;
      }
      if (state.currentTool === 'select') {
        selectObject({
          type: 'block',
          id: block.id,
          ref: block,
          bounds: { x: block.x, y: block.y, w: block.width || 300, h: block.height || 120 },
          locked: !!block.locked
        });
      }
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      initBlockX = block.x;
      initBlockY = block.y;
      el.classList.add('dragging');

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      e.stopPropagation();
    }

    function onPointerMove(e) {
      if (!isDragging) return;
      const zoom = state.zoomLevel || 1.0;
      const dx = (e.clientX - startX) / zoom;
      const dy = (e.clientY - startY) / zoom;
      block.x = Math.max(5, Math.round(initBlockX + dx));
      block.y = Math.max(5, Math.round(initBlockY + dy));
      el.style.left = block.x + 'px';
      el.style.top = block.y + 'px';
      markRecordingDirty();
      if (state.selectedObject && state.selectedObject.id === block.id) {
        updateSelectionOverlay();
      }
    }

    function onPointerUp(e) {
      if (!isDragging) return;
      isDragging = false;
      el.classList.remove('dragging');
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      saveState();
    }

    dragHandle.addEventListener('pointerdown', onPointerDown);
  }

  function renderBlocksDOM() {
    if (!blocksLayer) return;
    markRecordingDirty();
    blocksLayer.innerHTML = '';

    state.lessonBlocks.forEach(block => {
      const el = document.createElement('div');
      el.className = `wb-lesson-block wb-block-${block.type}`;
      el.id = block.id;
      el.style.left = block.x + 'px';
      el.style.top = block.y + 'px';
      if (block.width) el.style.width = block.width + 'px';

      if (block.type === 'stamp') {
        el.className += ' wb-block-stamp';
        el.style.borderColor = block.data.color || '#2563eb';
        el.innerHTML = `
          <span class="wb-stamp-icon">${block.data.icon || '⭐'}</span>
          <span class="wb-stamp-text" contenteditable="true" spellcheck="false">${block.data.text || 'Important'}</span>
          <button type="button" class="wb-stamp-del" title="Delete stamp">✕</button>
        `;
        const delBtn = el.querySelector('.wb-stamp-del');
        if (delBtn) {
          delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteBlock(block.id);
          });
        }
        const textSpan = el.querySelector('.wb-stamp-text');
        if (textSpan) {
          textSpan.addEventListener('blur', () => {
            block.data.text = textSpan.textContent.trim();
            saveState();
          });
          textSpan.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              textSpan.blur();
            }
          });
        }
      } else if (block.type === 'qa') {
        el.innerHTML = `
          <div class="wb-block-drag-bar">
            <span class="wb-block-label"><i class="fas fa-question-circle" style="color: #2563eb;"></i> Question Block</span>
            <div class="wb-block-controls">
              <button type="button" class="wb-block-ctrl-btn btn-reveal-toggle" title="Toggle Answer Reveal"><i class="fas ${block.data.revealed ? 'fa-eye-slash' : 'fa-eye'}"></i></button>
              <button type="button" class="wb-block-ctrl-btn btn-duplicate" title="Duplicate Block"><i class="fas fa-copy"></i></button>
              <button type="button" class="wb-block-ctrl-btn btn-delete" title="Delete Block"><i class="fas fa-times"></i></button>
            </div>
          </div>
          <div class="wb-qa-question" contenteditable="true" spellcheck="false" placeholder="Type question for students...">${block.data.question || ''}</div>
          <div class="wb-qa-answer-box">
            <div class="wb-qa-answer" contenteditable="true" spellcheck="false">${block.data.answer || ''}</div>
            <div class="wb-qa-curtain ${block.data.revealed ? 'revealed' : ''}">
              <i class="fas fa-eye"></i> Tap to Reveal Answer
            </div>
          </div>
        `;
        const curtain = el.querySelector('.wb-qa-curtain');
        if (curtain) {
          curtain.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleAnswerReveal(block.id);
          });
        }
        const revealBtn = el.querySelector('.btn-reveal-toggle');
        if (revealBtn) {
          revealBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleAnswerReveal(block.id);
          });
        }
        const qEl = el.querySelector('.wb-qa-question');
        if (qEl) {
          qEl.addEventListener('blur', () => {
            block.data.question = qEl.textContent.trim();
            saveState();
          });
        }
        const aEl = el.querySelector('.wb-qa-answer');
        if (aEl) {
          aEl.addEventListener('blur', () => {
            block.data.answer = aEl.textContent.trim();
            saveState();
          });
        }
      } else if (block.type === 'concept') {
        el.innerHTML = `
          <div class="wb-block-drag-bar">
            <span class="wb-block-label"><i class="fas fa-lightbulb" style="color: #10b981;"></i> Key Concept</span>
            <div class="wb-block-controls">
              <button type="button" class="wb-block-ctrl-btn btn-duplicate" title="Duplicate"><i class="fas fa-copy"></i></button>
              <button type="button" class="wb-block-ctrl-btn btn-delete" title="Delete"><i class="fas fa-times"></i></button>
            </div>
          </div>
          <div class="wb-concept-body" contenteditable="true" spellcheck="false">${block.data.body || ''}</div>
        `;
        const bodyEl = el.querySelector('.wb-concept-body');
        if (bodyEl) {
          bodyEl.addEventListener('blur', () => {
            block.data.body = bodyEl.textContent.trim();
            saveState();
          });
        }
      } else if (block.type === 'note') {
        el.className += ` sticky-${block.data.color || 'yellow'}`;
        el.innerHTML = `
          <div class="wb-block-drag-bar">
            <span class="wb-block-label"><i class="fas fa-sticky-note"></i> Sticky Note</span>
            <div class="wb-block-controls">
              <button type="button" class="wb-block-ctrl-btn btn-duplicate" title="Duplicate"><i class="fas fa-copy"></i></button>
              <button type="button" class="wb-block-ctrl-btn btn-delete" title="Delete"><i class="fas fa-times"></i></button>
            </div>
          </div>
          <div class="wb-sticky-content" contenteditable="true" spellcheck="false">${block.data.text || ''}</div>
        `;
        const cEl = el.querySelector('.wb-sticky-content');
        if (cEl) {
          cEl.addEventListener('blur', () => {
            block.data.text = cEl.textContent.trim();
            saveState();
          });
        }
      } else if (block.type === 'task') {
        const itemsHtml = (block.data.items || []).map((item, idx) => `
          <div class="wb-task-row">
            <input type="checkbox" class="wb-task-checkbox" data-idx="${idx}" ${item.done ? 'checked' : ''}>
            <span class="wb-task-text" contenteditable="true" data-idx="${idx}" spellcheck="false">${item.text}</span>
          </div>
        `).join('');

        el.innerHTML = `
          <div class="wb-block-drag-bar">
            <span class="wb-block-label"><i class="fas fa-tasks" style="color: #8b5cf6;"></i> Student Task</span>
            <div class="wb-block-controls">
              <button type="button" class="wb-block-ctrl-btn btn-duplicate" title="Duplicate"><i class="fas fa-copy"></i></button>
              <button type="button" class="wb-block-ctrl-btn btn-delete" title="Delete"><i class="fas fa-times"></i></button>
            </div>
          </div>
          <div class="wb-task-list">${itemsHtml}</div>
        `;

        el.querySelectorAll('.wb-task-checkbox').forEach(cb => {
          cb.addEventListener('change', (e) => {
            const idx = parseInt(e.target.getAttribute('data-idx'), 10);
            if (block.data.items && block.data.items[idx]) {
              block.data.items[idx].done = e.target.checked;
              saveState();
            }
          });
        });

        el.querySelectorAll('.wb-task-text').forEach(ts => {
          ts.addEventListener('blur', (e) => {
            const idx = parseInt(e.target.getAttribute('data-idx'), 10);
            if (block.data.items && block.data.items[idx]) {
              block.data.items[idx].text = e.target.textContent.trim();
              saveState();
            }
          });
        });
      } else if (block.type === 'reminder') {
        el.innerHTML = `
          <div class="wb-block-drag-bar">
            <span class="wb-block-label"><i class="fas fa-bell" style="color: #ef4444;"></i> Reminder</span>
            <div class="wb-block-controls">
              <button type="button" class="wb-block-ctrl-btn btn-delete" title="Delete"><i class="fas fa-times"></i></button>
            </div>
          </div>
          <div class="wb-reminder-body" contenteditable="true" spellcheck="false">${block.data.text || ''}</div>
        `;
        const rEl = el.querySelector('.wb-reminder-body');
        if (rEl) {
          rEl.addEventListener('blur', () => {
            block.data.text = rEl.textContent.trim();
            saveState();
          });
        }
      } else if (block.type === 'example') {
        el.innerHTML = `
          <div class="wb-block-drag-bar">
            <span class="wb-block-label"><i class="fas fa-graduation-cap" style="color: #6366f1;"></i> ${block.data.title || 'Model Example'}</span>
            <div class="wb-block-controls">
              <button type="button" class="wb-block-ctrl-btn btn-duplicate" title="Duplicate"><i class="fas fa-copy"></i></button>
              <button type="button" class="wb-block-ctrl-btn btn-delete" title="Delete"><i class="fas fa-times"></i></button>
            </div>
          </div>
          <div class="wb-example-body">
            <div class="wb-example-problem" contenteditable="true" spellcheck="false">${block.data.problem || ''}</div>
            <div class="wb-example-steps" contenteditable="true" spellcheck="false">${block.data.steps || ''}</div>
          </div>
        `;
        const probEl = el.querySelector('.wb-example-problem');
        if (probEl) {
          probEl.addEventListener('blur', () => {
            block.data.problem = probEl.textContent.trim();
            saveState();
          });
        }
        const stepsEl = el.querySelector('.wb-example-steps');
        if (stepsEl) {
          stepsEl.addEventListener('blur', () => {
            block.data.steps = stepsEl.textContent.trim();
            saveState();
          });
        }
      } else if (block.type === 'takeaway') {
        el.innerHTML = `
          <div class="wb-block-drag-bar">
            <span class="wb-block-label"><i class="fas fa-star" style="color: #f59e0b;"></i> ${block.data.title || 'Key Takeaway'}</span>
            <div class="wb-block-controls">
              <button type="button" class="wb-block-ctrl-btn btn-duplicate" title="Duplicate"><i class="fas fa-copy"></i></button>
              <button type="button" class="wb-block-ctrl-btn btn-delete" title="Delete"><i class="fas fa-times"></i></button>
            </div>
          </div>
          <div class="wb-takeaway-body" contenteditable="true" spellcheck="false">${block.data.text || ''}</div>
        `;
        const tEl = el.querySelector('.wb-takeaway-body');
        if (tEl) {
          tEl.addEventListener('blur', () => {
            block.data.text = tEl.textContent.trim();
            saveState();
          });
        }
      } else if (block.type === 'vocab') {
        el.innerHTML = `
          <div class="wb-block-drag-bar">
            <span class="wb-block-label"><i class="fas fa-spell-check" style="color: #0ea5e9;"></i> Vocabulary Card</span>
            <div class="wb-block-controls">
              <button type="button" class="wb-block-ctrl-btn btn-duplicate" title="Duplicate"><i class="fas fa-copy"></i></button>
              <button type="button" class="wb-block-ctrl-btn btn-delete" title="Delete"><i class="fas fa-times"></i></button>
            </div>
          </div>
          <div class="wb-vocab-body">
            <div class="wb-vocab-header-row">
              <span class="wb-vocab-word" contenteditable="true" spellcheck="false">${block.data.word || ''}</span>
              <span class="wb-vocab-pos" contenteditable="true" spellcheck="false">(${block.data.pos || 'term'})</span>
            </div>
            <div class="wb-vocab-meaning" contenteditable="true" spellcheck="false">${block.data.meaning || ''}</div>
            <div class="wb-vocab-example" contenteditable="true" spellcheck="false">${block.data.example || ''}</div>
          </div>
        `;
        const wEl = el.querySelector('.wb-vocab-word');
        if (wEl) {
          wEl.addEventListener('blur', () => {
            block.data.word = wEl.textContent.trim();
            saveState();
          });
        }
        const mEl = el.querySelector('.wb-vocab-meaning');
        if (mEl) {
          mEl.addEventListener('blur', () => {
            block.data.meaning = mEl.textContent.trim();
            saveState();
          });
        }
        const exEl = el.querySelector('.wb-vocab-example');
        if (exEl) {
          exEl.addEventListener('blur', () => {
            block.data.example = exEl.textContent.trim();
            saveState();
          });
        }
      } else if (block.type === 'tip') {
        el.innerHTML = `
          <div class="wb-block-drag-bar">
            <span class="wb-block-label"><i class="fas fa-chalkboard-teacher" style="color: #14b8a6;"></i> ${block.data.title || 'Teacher Tip'}</span>
            <div class="wb-block-controls">
              <button type="button" class="wb-block-ctrl-btn btn-delete" title="Delete"><i class="fas fa-times"></i></button>
            </div>
          </div>
          <div class="wb-tip-body" contenteditable="true" spellcheck="false">${block.data.tip || ''}</div>
        `;
        const tipEl = el.querySelector('.wb-tip-body');
        if (tipEl) {
          tipEl.addEventListener('blur', () => {
            block.data.tip = tipEl.textContent.trim();
            saveState();
          });
        }
      } else if (block.type === 'definition') {
        el.innerHTML = `
          <div class="wb-block-drag-bar">
            <span class="wb-block-label"><i class="fas fa-bookmark" style="color: #3b82f6;"></i> Definition Card</span>
            <div class="wb-block-controls">
              <button type="button" class="wb-block-ctrl-btn btn-duplicate" title="Duplicate"><i class="fas fa-copy"></i></button>
              <button type="button" class="wb-block-ctrl-btn btn-delete" title="Delete"><i class="fas fa-times"></i></button>
            </div>
          </div>
          <div class="wb-definition-body">
            <div class="wb-definition-term" contenteditable="true" spellcheck="false">${block.data.term || ''}</div>
            <div class="wb-definition-text" contenteditable="true" spellcheck="false">${block.data.definition || ''}</div>
          </div>
        `;
        const dtEl = el.querySelector('.wb-definition-term');
        if (dtEl) {
          dtEl.addEventListener('blur', () => {
            block.data.term = dtEl.textContent.trim();
            saveState();
          });
        }
        const dxEl = el.querySelector('.wb-definition-text');
        if (dxEl) {
          dxEl.addEventListener('blur', () => {
            block.data.definition = dxEl.textContent.trim();
            saveState();
          });
        }
      } else if (block.type === 'compare_block') {
        el.innerHTML = `
          <div class="wb-block-drag-bar">
            <span class="wb-block-label"><i class="fas fa-columns" style="color: #8b5cf6;"></i> ${block.data.title || 'Compare & Contrast'}</span>
            <div class="wb-block-controls">
              <button type="button" class="wb-block-ctrl-btn btn-duplicate" title="Duplicate"><i class="fas fa-copy"></i></button>
              <button type="button" class="wb-block-ctrl-btn btn-delete" title="Delete"><i class="fas fa-times"></i></button>
            </div>
          </div>
          <div class="wb-compare-grid">
            <div class="wb-compare-col wb-compare-left" contenteditable="true" spellcheck="false">${block.data.colA || ''}</div>
            <div class="wb-compare-col wb-compare-right" contenteditable="true" spellcheck="false">${block.data.colB || ''}</div>
          </div>
        `;
        const clEl = el.querySelector('.wb-compare-left');
        if (clEl) {
          clEl.addEventListener('blur', () => {
            block.data.colA = clEl.textContent.trim();
            saveState();
          });
        }
        const crEl = el.querySelector('.wb-compare-right');
        if (crEl) {
          crEl.addEventListener('blur', () => {
            block.data.colB = crEl.textContent.trim();
            saveState();
          });
        }
      } else if (block.type === 'infographic') {
        const nodesHtml = (block.data.nodes || []).map((nodeText, nIdx) => `
          <div class="wb-info-node" contenteditable="true" data-nidx="${nIdx}" spellcheck="false" title="Double click to edit node">${nodeText}</div>
          ${nIdx < (block.data.nodes.length - 1) ? '<span class="wb-info-arrow">➔</span>' : ''}
        `).join('');

        el.innerHTML = `
          <div class="wb-block-drag-bar">
            <span class="wb-block-label"><i class="fas fa-project-diagram" style="color: #2563eb;"></i> ${block.data.title || 'Infographic'}</span>
            <div class="wb-block-controls">
              <button type="button" class="wb-block-ctrl-btn btn-duplicate" title="Duplicate"><i class="fas fa-copy"></i></button>
              <button type="button" class="wb-block-ctrl-btn btn-delete" title="Delete"><i class="fas fa-times"></i></button>
            </div>
          </div>
          <div class="wb-info-nodes-container">${nodesHtml}</div>
        `;

        el.querySelectorAll('.wb-info-node').forEach(nd => {
          nd.addEventListener('blur', (e) => {
            const nIdx = parseInt(e.target.getAttribute('data-nidx'), 10);
            if (block.data.nodes && block.data.nodes[nIdx] !== undefined) {
              block.data.nodes[nIdx] = e.target.textContent.trim();
              saveState();
            }
          });
        });
      }

      // Generic duplicate and delete buttons for blocks with drag bars
      const dupBtn = el.querySelector('.btn-duplicate');
      if (dupBtn) {
        dupBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          duplicateBlock(block.id);
        });
      }
      const delBtn = el.querySelector('.btn-delete');
      if (delBtn) {
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteBlock(block.id);
        });
      }

      // Attach Drag Handling
      attachBlockDrag(el, block);

      blocksLayer.appendChild(el);
    });

    updateAdRailFallback();
  }

  function initLessonBlocks() {
    renderBlocksDOM();
  }

  /* ============================================================
     PHASE 2: EDITABLE INFOGRAPHICS BUILDER
     ============================================================ */
  function insertInfographic(type) {
    let title = 'PROCESS';
    let nodes = ['Step 1', 'Step 2', 'Step 3'];

    if (type === 'process3') {
      title = '3-STEP PROCESS';
      nodes = ['Step 1: Concept', 'Step 2: Method', 'Step 3: Solution'];
    } else if (type === 'process4') {
      title = '4-STEP SEQUENCE';
      nodes = ['Step 1: Input', 'Step 2: Reaction', 'Step 3: Separation', 'Step 4: Yield'];
    } else if (type === 'cycle') {
      title = 'CYCLE DIAGRAM';
      nodes = ['Evaporation', 'Condensation', 'Precipitation', 'Collection'];
    } else if (type === 'timeline') {
      title = 'TIMELINE AXIS';
      nodes = ['Phase 1 (Origin)', 'Phase 2 (Growth)', 'Phase 3 (Peak)', 'Phase 4 (Legacy)'];
    } else if (type === 'cause_effect') {
      title = 'CAUSE ➔ EFFECT';
      nodes = ['Cause / Trigger', 'Mechanism / Action', 'Direct Result / Impact'];
    } else if (type === 'compare') {
      title = 'COMPARISON';
      nodes = ['Concept A (Features)', 'VS', 'Concept B (Features)'];
    } else if (type === 'before_after') {
      title = 'BEFORE ➔ AFTER';
      nodes = ['Initial State (Before)', 'Transformation', 'Final State (After)'];
    } else if (type === 'concept_map') {
      title = 'CONCEPT MAP';
      nodes = ['Branch 1', 'Central Idea', 'Branch 2', 'Branch 3'];
    } else if (type === 'mind_map') {
      title = 'MIND MAP';
      nodes = ['Branch 1 (Subtopic)', 'Core Concept', 'Branch 2 (Evidence)', 'Branch 3 (Application)'];
    } else if (type === 'key_concept') {
      title = 'KEY CONCEPT';
      nodes = ['Core Principle', 'Real-world Context', 'Application & Mastery'];
    } else if (type === 'sequence') {
      title = '5-STAGE SEQUENCE';
      nodes = ['1. Initiate', '2. Analyze', '3. Model', '4. Verify', '5. Master'];
    } else if (type === 'problem_solution') {
      title = 'PROBLEM ➔ SOLUTION';
      nodes = ['The Problem / Challenge', 'Investigation & Clues', 'Proposed Solution', 'Verified Result'];
    }

    addLessonBlock('infographic', { subType: type, title, nodes });
    PedagogicalSignal.record('infographic_inserted', { type });
    TeachingSession.logAction('infographic_inserted', { type });
  }

  /* ============================================================
     PHASE 2: CURRICULUM TEACHING TEMPLATES ENGINE
     ============================================================ */
  function loadTeachingTemplate(tmplId) {
    hideEmptyState();

    if (tmplId === 'water_cycle') {
      setSubjectMode('science');
      insertInfographic('cycle');
      addLessonBlock('qa', {
        question: 'What energy source powers the continuous water cycle?',
        answer: 'Solar energy from the Sun heats water bodies and drives evaporation and air currents.'
      }, 50, 200);
      addLessonBlock('concept', {
        title: 'WATER CYCLE PRINCIPLE',
        body: 'Total water on Earth remains constant through phase changes between liquid, vapour, and ice.'
      }, 50, 60);
    } else if (tmplId === 'plant_cell') {
      setSubjectMode('science');
      addLessonBlock('concept', {
        title: 'PLANT CELL STRUCTURE',
        body: 'Plant cells contain rigid cell walls, large central vacuoles, and chloroplasts for photosynthesis.'
      }, 50, 50);
      stampSticker('sci_label', 440, 50);
      addLessonBlock('task', {
        title: 'IDENTIFY CELL ORGANELLES',
        items: [
          { text: 'Label the outer Cellulose Cell Wall', done: false },
          { text: 'Locate Chloroplasts for chlorophyll', done: false },
          { text: 'Identify the central nucleus and vacuole', done: false }
        ]
      }, 50, 180);
    } else if (tmplId === 'science_obs') {
      setSubjectMode('science');
      setGridBackground('table');
      addLessonBlock('concept', {
        title: 'SCIENTIFIC METHOD',
        body: 'State Hypothesis ➔ Record Observations ➔ Analyze Results ➔ Formulate Conclusion'
      }, 50, 50);
      stampSticker('sci_hypo', 50, 170);
      stampSticker('sci_res', 240, 170);
      stampSticker('sci_conc', 420, 170);
    } else if (tmplId === 'fractions') {
      setSubjectMode('math');
      addLessonBlock('concept', {
        title: 'FRACTION COMPARISON BARS',
        body: 'Compare relative lengths: 1 Whole = 2/2 = 4/4 = 8/8.'
      }, 50, 50);
      addLessonBlock('infographic', {
        subType: 'fractions',
        title: 'FRACTION DIVISION',
        nodes: ['1 Whole (1/1)', 'Two Halves (1/2 + 1/2)', 'Four Quarters (1/4)', 'Eight Eighths (1/8)']
      }, 50, 160);
      addLessonBlock('qa', {
        question: 'Which is larger: 3/4 or 5/8?',
        answer: '3/4 = 6/8, so 3/4 is greater than 5/8 by 1/8.'
      }, 50, 310);
    } else if (tmplId === 'number_line') {
      setSubjectMode('math');
      setGridBackground('numline');
      stampSticker('math_step1', 60, 60);
      addLessonBlock('qa', {
        question: 'Plot and calculate: -6 + 9 = ?',
        answer: 'Starting at -6, move 9 units to the right to reach +3.'
      }, 200, 50);
    } else if (tmplId === 'coord_plane') {
      setSubjectMode('math');
      setGridBackground('coord');
      stampSticker('math_geom', 60, 60);
      addLessonBlock('concept', {
        title: 'COORDINATE GEOMETRY',
        body: 'Quadrant I (+,+), Quadrant II (-,+), Quadrant III (-,-), Quadrant IV (+,-).'
      }, 180, 50);
    } else if (tmplId === 'vocab_matrix') {
      setSubjectMode('english');
      setGridBackground('lines');
      addLessonBlock('concept', {
        title: 'VOCABULARY MATRIX',
        body: 'Target Word ➔ Definition ➔ Synonyms ➔ Contextual Sentence'
      }, 50, 50);
      addLessonBlock('infographic', {
        subType: 'vocab',
        title: 'WORD DECONSTRUCTION',
        nodes: ['Word: Resilient', 'Meaning: Able to recover quickly', 'Sentence: The trees were resilient against the storm.']
      }, 50, 170);
    } else if (tmplId === 'reading_comp') {
      setSubjectMode('english');
      setGridBackground('lines');
      addLessonBlock('concept', {
        title: 'READING COMPREHENSION FRAMEWORK',
        body: 'Read text passage ➔ Identify main theme ➔ Highlight key evidence ➔ Answer inferential questions'
      }, 50, 50);
      addLessonBlock('qa', {
        question: 'What is the author’s primary purpose in the opening paragraph?',
        answer: 'To establish tone, introduce the central conflict, and engage reader empathy.'
      }, 50, 180);
    } else if (tmplId === 'speech_outline') {
      setSubjectMode('speech');
      setGridBackground('speech');
      insertInfographic('process3');
      const b = state.lessonBlocks[state.lessonBlocks.length - 1];
      if (b) {
        b.data.title = 'SPEECH FRAMEWORK';
        b.data.nodes = ['1. Hook & Introduction', '2. Core Arguments & Evidence', '3. Call to Action / Moral'];
        renderBlocksDOM();
      }
      stampSticker('spk_hook', 50, 180);
      stampSticker('spk_main', 240, 180);
      stampSticker('spk_moral', 430, 180);
    } else if (tmplId === 'cue_cards') {
      setSubjectMode('speech');
      addLessonBlock('note', { color: 'blue', text: 'CARD 1: Opening Hook (0:00 - 0:30)\n- Shocking statistic\n- Relatable rhetorical question' }, 50, 60);
      addLessonBlock('note', { color: 'yellow', text: 'CARD 2: Main Argument (0:30 - 2:00)\n- Point 1: Real-world example\n- Point 2: Supporting fact\n- Strategic pause' }, 300, 60);
      addLessonBlock('note', { color: 'mint', text: 'CARD 3: Conclusion (2:00 - 2:30)\n- Summarize thesis\n- Final call to action\n- Strong closing line' }, 550, 60);
    }

    PedagogicalSignal.record('template_loaded', { templateId: tmplId });
    TeachingSession.logAction('template_loaded', { templateId: tmplId });
    saveState();
  }

  /* ============================================================
     PHASE 2: 8-STAGE PEDAGOGICAL LESSON FLOW ENGINE
     ============================================================ */
  function setLessonStage(stageNum) {
    state.lessonStage = Math.max(1, Math.min(8, stageNum));
    const stepBtns = document.querySelectorAll('.wb-flow-step');
    stepBtns.forEach((btn) => {
      const s = parseInt(btn.getAttribute('data-stage'), 10);
      if (s === state.lessonStage) {
        btn.classList.add('active');
        btn.classList.remove('completed');
      } else if (s < state.lessonStage) {
        btn.classList.remove('active');
        btn.classList.add('completed');
      } else {
        btn.classList.remove('active');
        btn.classList.remove('completed');
      }
    });

    const stageNames = [
      '1. Intro', '2. Explain', '3. Example', '4. Ask',
      '5. Think', '6. Reveal', '7. Practice', '8. Recap'
    ];
    const railStage = document.getElementById('wbRailStage');
    if (railStage) railStage.textContent = stageNames[state.lessonStage - 1] || '1. Intro';

    PedagogicalSignal.record('lesson_stage_changed', { stage: state.lessonStage });
    TeachingSession.logAction('lesson_stage_changed', { stage: state.lessonStage });
  }

  function nextLessonStage() {
    setLessonStage(state.lessonStage < 8 ? state.lessonStage + 1 : 1);
  }

  function prevLessonStage() {
    setLessonStage(state.lessonStage > 1 ? state.lessonStage - 1 : 8);
  }

  /* ============================================================
     PHASE 2: SPOTLIGHT & TRANSIENT LASER POINTER ENGINE
     ============================================================ */
  function initSpotlightAndLaser() {
    if (spotlightCanvas) {
      spotlightCanvas.addEventListener('pointermove', updateSpotlight);
    }
    if (laserCanvas) {
      laserCanvas.addEventListener('pointermove', updateLaser);
      laserCanvas.addEventListener('pointerleave', () => {
        state.laserPoints = [];
      });
    }
  }

  function toggleSpotlight(enable) {
    if (enable === undefined) {
      enable = !state.isSpotlightActive;
    }
    state.isSpotlightActive = enable;
    markRecordingDirty();
    if (spotlightCanvas) {
      spotlightCanvas.style.display = state.isSpotlightActive ? 'block' : 'none';
      if (state.isSpotlightActive) {
        spotlightCanvas.width = canvas.width;
        spotlightCanvas.height = canvas.height;
        spotlightCanvas.style.width = canvas.style.width;
        spotlightCanvas.style.height = canvas.style.height;
        if (spotlightCtx) {
          const dpr = window.devicePixelRatio || 1;
          spotlightCtx.setTransform(1, 0, 0, 1, 0, 0);
          spotlightCtx.scale(dpr, dpr);
        }
      }
    }
    const spotlightBtn = document.getElementById('wbPresSpotlightBtn');
    if (spotlightBtn) {
      if (state.isSpotlightActive) spotlightBtn.classList.add('active');
      else spotlightBtn.classList.remove('active');
    }
    PedagogicalSignal.record('spotlight_toggled', { active: state.isSpotlightActive });
    TeachingSession.logAction('spotlight_used', { active: state.isSpotlightActive });
  }

  function updateSpotlight(e) {
    if (!state.isSpotlightActive || !spotlightCanvas || !spotlightCtx) return;
    markRecordingDirty();
    const coords = getCanvasCoords(e);
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    spotlightCtx.clearRect(0, 0, w, h);
    spotlightCtx.save();
    spotlightCtx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    spotlightCtx.fillRect(0, 0, w, h);

    spotlightCtx.globalCompositeOperation = 'destination-out';
    spotlightCtx.beginPath();
    spotlightCtx.arc(coords.x, coords.y, 130, 0, Math.PI * 2);
    spotlightCtx.fill();
    spotlightCtx.restore();
  }

  function toggleLaser(enable) {
    if (enable === undefined) {
      enable = !state.isLaserActive;
    }
    state.isLaserActive = enable;
    markRecordingDirty();
    if (laserCanvas) {
      laserCanvas.style.display = state.isLaserActive ? 'block' : 'none';
      if (state.isLaserActive) {
        laserCanvas.width = canvas.width;
        laserCanvas.height = canvas.height;
        laserCanvas.style.width = canvas.style.width;
        laserCanvas.style.height = canvas.style.height;
        if (laserCtx) {
          const dpr = window.devicePixelRatio || 1;
          laserCtx.setTransform(1, 0, 0, 1, 0, 0);
          laserCtx.scale(dpr, dpr);
        }
        state.laserPoints = [];
        requestAnimationFrame(renderLaserLoop);
      }
    }
    const laserBtn = document.getElementById('wbPresLaserBtn');
    if (laserBtn) {
      if (state.isLaserActive) laserBtn.classList.add('active');
      else laserBtn.classList.remove('active');
    }
    PedagogicalSignal.record('laser_toggled', { active: state.isLaserActive });
    TeachingSession.logAction('laser_used', { active: state.isLaserActive });
  }

  function updateLaser(e) {
    if (!state.isLaserActive) return;
    const coords = getCanvasCoords(e);
    state.laserPoints.push({ x: coords.x, y: coords.y, time: Date.now() });
  }

  function renderLaserLoop() {
    if (!state.isLaserActive || !laserCanvas || !laserCtx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const now = Date.now();

    laserCtx.clearRect(0, 0, w, h);
    state.laserPoints = state.laserPoints.filter(p => now - p.time < 420);

    if (state.laserPoints.length > 0) {
      markRecordingDirty();
      laserCtx.save();
      laserCtx.lineCap = 'round';
      laserCtx.lineJoin = 'round';

      for (let i = 1; i < state.laserPoints.length; i++) {
        const p0 = state.laserPoints[i - 1];
        const p1 = state.laserPoints[i];
        const age = now - p1.time;
        const alpha = Math.max(0, 1 - age / 420);

        laserCtx.strokeStyle = `rgba(239, 68, 68, ${alpha * 0.8})`;
        laserCtx.lineWidth = 4 * alpha;
        laserCtx.beginPath();
        laserCtx.moveTo(p0.x, p0.y);
        laserCtx.lineTo(p1.x, p1.y);
        laserCtx.stroke();
      }

      // Draw bright glowing laser point at latest position
      const latest = state.laserPoints[state.laserPoints.length - 1];
      laserCtx.shadowColor = '#ef4444';
      laserCtx.shadowBlur = 12;
      laserCtx.fillStyle = '#ef4444';
      laserCtx.beginPath();
      laserCtx.arc(latest.x, latest.y, 6, 0, Math.PI * 2);
      laserCtx.fill();

      laserCtx.fillStyle = '#ffffff';
      laserCtx.beginPath();
      laserCtx.arc(latest.x, latest.y, 2.5, 0, Math.PI * 2);
      laserCtx.fill();
      laserCtx.restore();
    }

    requestAnimationFrame(renderLaserLoop);
  }

  /* ============================================================
     HELPER: RENDER ACTIVE LESSON BLOCKS ON 2D CONTEXT FOR EXPORT
     ============================================================ */
  function renderBlocksOnContext(targetCtx, scaleFactor = 1) {
    if (!state.lessonBlocks || !state.lessonBlocks.length) return;
    targetCtx.save();

    state.lessonBlocks.forEach((block) => {
      const x = block.x * scaleFactor;
      const y = block.y * scaleFactor;

      targetCtx.fillStyle = '#ffffff';
      targetCtx.strokeStyle = '#cbd5e1';
      targetCtx.lineWidth = 1.5;

      if (block.type === 'stamp') {
        const text = (block.data.icon ? block.data.icon + ' ' : '') + (block.data.text || '');
        targetCtx.font = `800 13px Inter, sans-serif`;
        const metrics = targetCtx.measureText(text);
        const w = metrics.width + 24;
        const h = 28;

        targetCtx.beginPath();
        targetCtx.roundRect(x, y, w, h, 14);
        targetCtx.fill();
        targetCtx.strokeStyle = block.data.color || '#2563eb';
        targetCtx.stroke();

        targetCtx.fillStyle = '#0f172a';
        targetCtx.textBaseline = 'middle';
        targetCtx.fillText(text, x + 12, y + h / 2);
      } else if (block.type === 'note') {
        const colors = { yellow: '#fef08a', mint: '#bbf7d0', blue: '#bae6fd', peach: '#fed7aa' };
        targetCtx.fillStyle = colors[block.data.color] || '#fef08a';
        const w = (block.width || 210) * scaleFactor;
        const h = (block.height || 140) * scaleFactor;
        targetCtx.beginPath();
        targetCtx.roundRect(x, y, w, h, 4);
        targetCtx.fill();
        targetCtx.stroke();

        targetCtx.fillStyle = '#1e293b';
        targetCtx.font = `600 13px Inter, sans-serif`;
        targetCtx.textBaseline = 'top';
        const lines = (block.data.text || '').split('\n');
        lines.forEach((line, idx) => {
          targetCtx.fillText(line, x + 10, y + 26 + idx * 18);
        });
      } else if (block.type === 'qa') {
        const w = (block.width || 340) * scaleFactor;
        const h = (block.height || 140) * scaleFactor;
        targetCtx.beginPath();
        targetCtx.roundRect(x, y, w, h, 8);
        targetCtx.fill();
        targetCtx.strokeStyle = '#2563eb';
        targetCtx.stroke();

        targetCtx.fillStyle = '#2563eb';
        targetCtx.font = `800 11px Inter, sans-serif`;
        targetCtx.textBaseline = 'top';
        targetCtx.fillText('QUESTION', x + 10, y + 8);

        targetCtx.fillStyle = '#0f172a';
        targetCtx.font = `700 13px Inter, sans-serif`;
        targetCtx.fillText(block.data.question || '', x + 10, y + 26);

        if (block.data.revealed) {
          targetCtx.fillStyle = '#16a34a';
          targetCtx.font = `800 11px Inter, sans-serif`;
          targetCtx.fillText('ANSWER', x + 10, y + 54);
          targetCtx.fillStyle = '#1e293b';
          targetCtx.font = `600 13px Inter, sans-serif`;
          targetCtx.fillText(block.data.answer || '', x + 10, y + 70);
        } else {
          targetCtx.fillStyle = '#2563eb';
          targetCtx.fillRect(x + 10, y + 54, w - 20, 36);
          targetCtx.fillStyle = '#ffffff';
          targetCtx.font = `800 11px Inter, sans-serif`;
          targetCtx.textBaseline = 'middle';
          targetCtx.fillText('[ REVEAL ANSWER: HIDDEN IN CLASS ]', x + 20, y + 72);
        }
      } else if (block.type === 'concept') {
        const w = (block.width || 300) * scaleFactor;
        const h = (block.height || 95) * scaleFactor;
        targetCtx.beginPath();
        targetCtx.roundRect(x, y, w, h, 8);
        targetCtx.fill();
        targetCtx.strokeStyle = '#10b981';
        targetCtx.stroke();

        targetCtx.fillStyle = '#10b981';
        targetCtx.font = `800 11px Inter, sans-serif`;
        targetCtx.textBaseline = 'top';
        targetCtx.fillText('KEY CONCEPT', x + 10, y + 8);
        targetCtx.fillStyle = '#0f172a';
        targetCtx.font = `600 13px Inter, sans-serif`;
        targetCtx.fillText(block.data.body || '', x + 10, y + 28);
      } else if (block.type === 'infographic') {
        const w = (block.width || 400) * scaleFactor;
        const h = (block.height || 105) * scaleFactor;
        targetCtx.beginPath();
        targetCtx.roundRect(x, y, w, h, 10);
        targetCtx.fill();
        targetCtx.stroke();

        targetCtx.fillStyle = '#2563eb';
        targetCtx.font = `800 11px Inter, sans-serif`;
        targetCtx.textBaseline = 'top';
        targetCtx.fillText(block.data.title || 'PROCESS', x + 12, y + 8);

        const nodes = block.data.nodes || [];
        const nodeW = Math.max(70, Math.floor((w - 30 - nodes.length * 15) / nodes.length));
        nodes.forEach((nodeText, nIdx) => {
          const nx = x + 12 + nIdx * (nodeW + 16);
          const ny = y + 32;
          targetCtx.fillStyle = '#f1f5f9';
          targetCtx.strokeStyle = '#cbd5e1';
          targetCtx.beginPath();
          targetCtx.roundRect(nx, ny, nodeW, 36, 6);
          targetCtx.fill();
          targetCtx.stroke();

          targetCtx.fillStyle = '#0f172a';
          targetCtx.font = `700 11px Inter, sans-serif`;
          targetCtx.textBaseline = 'middle';
          targetCtx.fillText(nodeText, nx + 6, ny + 18);

          if (nIdx < nodes.length - 1) {
            targetCtx.fillStyle = '#2563eb';
            targetCtx.font = `900 13px Inter, sans-serif`;
            targetCtx.fillText('➔', nx + nodeW + 3, ny + 18);
          }
        });
      }
    });

    targetCtx.restore();
  }

  /* ============================================================
     PRESENTATION / FULLSCREEN MODE (POWERPOINT-GRADE)
     ============================================================ */
  function togglePresentationMode(enable) {
    const app = document.getElementById('whiteboardApp');
    const adPres = document.getElementById('vffAdPresentation');

    if (enable === undefined) {
      enable = !state.isPresentationMode;
    }
    state.isPresentationMode = enable;

    if (state.isPresentationMode) {
      document.body.classList.add('vff-presentation-active');
      if (app) app.classList.add('presentation-mode');
      if (presentBtn) presentBtn.style.display = 'none';
      if (exitPresentBtn) exitPresentBtn.style.display = 'inline-flex';
      if (adPres) adPres.style.display = 'flex';
      if (presToolsBtn) presToolsBtn.style.display = 'none';
      if (presToolPanel) presToolPanel.style.display = 'none';
      state.isPresToolPanelOpen = false;

      // Show and sync dedicated compact presentation header
      if (presHeader) presHeader.style.display = 'flex';
      updatePresentationHeader();

      // Ensure selection overlay and popovers are hidden
      deselectObject();
      toggleShapesPopover(false);
      toggleMathPopover(false);

      // Attempt native browser fullscreen
      try {
        const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
        if (!isFs && app) {
          const req = app.requestFullscreen || app.webkitRequestFullscreen || app.mozRequestFullScreen || app.msRequestFullscreen;
          if (req) {
            req.call(app).catch(() => {});
          }
        }
      } catch (err) {}

      TeachingSession.logAction('presentation_mode_enter');
      PedagogicalSignal.record('presentation_mode_enter');
    } else {
      document.body.classList.remove('vff-presentation-active');
      if (app) app.classList.remove('presentation-mode');
      if (presentBtn) presentBtn.style.display = 'inline-flex';
      if (exitPresentBtn) exitPresentBtn.style.display = 'none';
      if (adPres) adPres.style.display = 'none';
      if (presToolsBtn) presToolsBtn.style.display = 'none';
      if (presToolPanel) presToolPanel.style.display = 'none';
      state.isPresToolPanelOpen = false;

      // Hide presentation header & close active floating panels
      if (presHeader) presHeader.style.display = 'none';
      deselectObject();
      toggleShapesPopover(false);
      toggleMathPopover(false);
      toggleAssetsDrawer(false);
      togglePresToolPanel(false);
      togglePresQuickActions(false);
      togglePresBgMenu(false);
      toggleSubjectDrawer(false);

      // Exit native browser fullscreen if active
      try {
        const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
        if (isFs) {
          const exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
          if (exit) {
            exit.call(document).catch(() => {});
          }
        }
      } catch (err) {}

      TeachingSession.logAction('presentation_mode_exit');
      PedagogicalSignal.record('presentation_mode_exit');
    }

    resizeCanvas();
    setTimeout(resizeCanvas, 60);
    setTimeout(resizeCanvas, 180);
  }

  function togglePresToolPanel(open) {
    if (!presToolPanel) return;
    if (open === undefined) {
      open = !state.isPresToolPanelOpen;
    }
    state.isPresToolPanelOpen = open;
    presToolPanel.style.display = state.isPresToolPanelOpen ? 'flex' : 'none';

    // Sync active state on Tools buttons
    const toolsBtns = [presToolsBtn, presHeaderToolsBtn, document.getElementById('wbPresHeaderToolsBtn')];
    toolsBtns.forEach(btn => {
      if (btn) {
        if (state.isPresToolPanelOpen) {
          btn.classList.add('active');
          btn.setAttribute('aria-expanded', 'true');
        } else {
          btn.classList.remove('active');
          btn.setAttribute('aria-expanded', 'false');
        }
      }
    });

    if (state.isPresToolPanelOpen) {
      if (state.isAssetsDrawerOpen) toggleAssetsDrawer(false);
      if (state.isPresQuickActionsOpen) togglePresQuickActions(false);
      if (state.isPresBgMenuOpen) togglePresBgMenu(false);
      if (state.isSubjectDrawerOpen) toggleSubjectDrawer(false);
    }
  }

  function togglePresQuickActions(open) {
    const qaMenu = presQuickActionsMenu || document.getElementById('wbPresQuickActionsMenu');
    const qaBtn = presQuickActionsBtn || document.getElementById('wbPresQuickActionsBtn');
    if (!qaMenu) return;
    if (open === undefined) {
      open = !state.isPresQuickActionsOpen;
    }
    state.isPresQuickActionsOpen = open;
    qaMenu.style.display = state.isPresQuickActionsOpen ? 'flex' : 'none';
    if (qaBtn) {
      if (state.isPresQuickActionsOpen) {
        qaBtn.classList.add('active');
        qaBtn.setAttribute('aria-expanded', 'true');
      } else {
        qaBtn.classList.remove('active');
        qaBtn.setAttribute('aria-expanded', 'false');
      }
    }
    if (state.isPresQuickActionsOpen) {
      if (state.isPresBgMenuOpen) togglePresBgMenu(false);
      if (state.isPresToolPanelOpen) togglePresToolPanel(false);
      if (state.isAssetsDrawerOpen) toggleAssetsDrawer(false);
      if (state.isSubjectDrawerOpen) toggleSubjectDrawer(false);
    }
  }

  function togglePresBgMenu(open) {
    const bgMenu = presBgMenu || document.getElementById('wbPresBgMenu');
    const bgBtn = presBgBtn || document.getElementById('wbPresBgBtn');
    if (!bgMenu) return;
    if (open === undefined) {
      open = !state.isPresBgMenuOpen;
    }
    state.isPresBgMenuOpen = open;
    bgMenu.style.display = state.isPresBgMenuOpen ? 'flex' : 'none';
    if (bgBtn) {
      if (state.isPresBgMenuOpen) {
        bgBtn.classList.add('active');
        bgBtn.setAttribute('aria-expanded', 'true');
      } else {
        bgBtn.classList.remove('active');
        bgBtn.setAttribute('aria-expanded', 'false');
      }
    }
    if (state.isPresBgMenuOpen) {
      updatePresBgActiveState(state.gridPattern);
      if (state.isPresQuickActionsOpen) togglePresQuickActions(false);
      if (state.isPresToolPanelOpen) togglePresToolPanel(false);
      if (state.isAssetsDrawerOpen) toggleAssetsDrawer(false);
      if (state.isSubjectDrawerOpen) toggleSubjectDrawer(false);
    }
  }

  function updatePresBgActiveState(pattern) {
    const currentPattern = pattern || state.gridPattern;
    const presBgBtns = document.querySelectorAll('[data-pres-bg]');
    presBgBtns.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-pres-bg') === currentPattern);
    });

    const currentSurface = state.canvasSurface || 'white';
    const presSurfBtns = document.querySelectorAll('[data-pres-surface], [data-surface], .wb-pres-surface-item');
    presSurfBtns.forEach(btn => {
      const s = btn.getAttribute('data-pres-surface') || btn.getAttribute('data-surface');
      btn.classList.toggle('active', s === currentSurface);
    });
  }

  // Sync state if user exits native fullscreen via browser controls
  function syncFullscreenState() {
    const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
    if (!isFs && state.isPresentationMode) {
      togglePresentationMode(false);
    }
  }

  ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(evt => {
    document.addEventListener(evt, syncFullscreenState);
  });

  /* ============================================================
     COLLAPSIBLE TEACHING TOOLBAR
     ============================================================ */
  function toggleToolbar(collapse) {
    if (!toolbarEl) return;

    if (collapse === undefined) {
      collapse = !state.isToolbarCollapsed;
    }
    state.isToolbarCollapsed = collapse;

    const icon = document.getElementById('wbToggleToolbarIcon');
    const grid = document.querySelector('.wb-workspace-grid');

    if (state.isToolbarCollapsed) {
      toolbarEl.classList.add('collapsed');
      if (grid) grid.classList.add('toolbar-collapsed');
      if (icon) icon.className = 'fas fa-chevron-right';
      if (toggleToolbarBtn) toggleToolbarBtn.title = 'Show Tools (→)';
      TeachingSession.logAction('toolbar_hide');
    } else {
      toolbarEl.classList.remove('collapsed');
      if (grid) grid.classList.remove('toolbar-collapsed');
      if (icon) icon.className = 'fas fa-chevron-left';
      if (toggleToolbarBtn) toggleToolbarBtn.title = 'Hide Tools (←)';
      TeachingSession.logAction('toolbar_show');
    }

    setTimeout(resizeCanvas, 120);
  }

  /* ============================================================
     STATE & UNDO / REDO MANAGER
     Unified Multi-layer Educator History: Freehand Ink, Images,
     PDF Material Transform, and Lesson Blocks
     ============================================================ */
  function cloneImages(imgs) {
    if (!imgs || !Array.isArray(imgs)) return [];
    return imgs.map((item) => ({
      id: item.id || ('img_' + Math.random().toString(36).substr(2, 6)),
      img: item.img,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
      locked: !!item.locked
    }));
  }

  function clonePdfTransform(t) {
    if (!t) return null;
    return {
      x: t.x || 0,
      y: t.y || 0,
      width: t.width || 0,
      height: t.height || 0,
      locked: !!t.locked
    };
  }

  function cloneLessonBlocks(blks) {
    if (!blks || !Array.isArray(blks)) return [];
    return JSON.parse(JSON.stringify(blks));
  }

  function saveState() {
    if (state.historyIndex < state.historyStack.length - 1) {
      state.historyStack = state.historyStack.slice(0, state.historyIndex + 1);
    }

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const entry = {
      ink: imgData,
      images: cloneImages(state.loadedImages),
      pdfTransform: clonePdfTransform(state.pdfMaterialTransform),
      blocks: cloneLessonBlocks(state.lessonBlocks)
    };
    state.historyStack.push(entry);

    if (state.historyStack.length > state.maxHistory) {
      state.historyStack.shift();
    } else {
      state.historyIndex++;
    }

    updateUndoRedoUI();
  }

  function undo() {
    if (state.historyIndex > 0) {
      state.historyIndex--;
      redrawCanvas();
      updateUndoRedoUI();
      TeachingSession.logAction('whiteboard_undo');
    }
  }

  function redo() {
    if (state.historyIndex < state.historyStack.length - 1) {
      state.historyIndex++;
      redrawCanvas();
      updateUndoRedoUI();
      TeachingSession.logAction('whiteboard_redo');
    }
  }

  function updateUndoRedoUI() {
    if (undoBtn) undoBtn.disabled = state.historyIndex <= 0;
    if (redoBtn) redoBtn.disabled = state.historyIndex >= state.historyStack.length - 1;

    const presUndoBtn = document.getElementById('wbPresUndoBtn');
    const presRedoBtn = document.getElementById('wbPresRedoBtn');
    if (presUndoBtn) presUndoBtn.disabled = state.historyIndex <= 0;
    if (presRedoBtn) presRedoBtn.disabled = state.historyIndex >= state.historyStack.length - 1;
  }

  function redrawCanvas() {
    markRecordingDirty();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    const entry = state.historyStack[state.historyIndex];
    if (entry) {
      if (entry instanceof ImageData) {
        ctx.putImageData(entry, 0, 0);
      } else if (entry.ink) {
        ctx.putImageData(entry.ink, 0, 0);
        if (entry.images !== undefined) {
          state.loadedImages = cloneImages(entry.images);
          redrawImageCanvas();
        }
        if (entry.pdfTransform !== undefined) {
          state.pdfMaterialTransform = clonePdfTransform(entry.pdfTransform);
          if (typeof redrawPdfCanvas === 'function') redrawPdfCanvas();
        }
        if (entry.blocks !== undefined) {
          state.lessonBlocks = cloneLessonBlocks(entry.blocks);
          renderBlocksDOM();
        }
        if (state.selectedObject) {
          updateSelectionOverlay();
        }
      }
    }

    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
  }

  function clearBoard() {
    if (confirm('Are you sure you want to clear the whiteboard canvas?')) {
      markRecordingDirty();
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();

      state.loadedImages = [];
      redrawImageCanvas();

      state.lessonBlocks = [];
      renderBlocksDOM();

      deselectObject();

      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      saveState();
      if (!state.pdfLoaded) {
        showEmptyState();
      }
      TeachingSession.logAction('whiteboard_clear');
    }
  }

  /* ============================================================
     ZOOM & PAN CONTROLS
     ============================================================ */
  function setZoom(level) {
    state.zoomLevel = Math.max(0.25, Math.min(3.0, level));
    if (zoomValLabel) zoomValLabel.textContent = Math.round(state.zoomLevel * 100) + '%';
    applyTransform();
  }

  function zoomIn() { setZoom(state.zoomLevel + 0.15); }
  function zoomOut() { setZoom(state.zoomLevel - 0.15); }
  function resetZoom() {
    state.zoomLevel = 1.0;
    state.panX = 0;
    state.panY = 0;
    if (zoomValLabel) zoomValLabel.textContent = '100%';
    applyTransform();
  }

  function applyTransform() {
    markRecordingDirty();
    const transformVal = (Math.abs(state.zoomLevel - 1.0) < 0.001 && state.panX === 0 && state.panY === 0)
      ? 'none'
      : `translate(${state.panX}px, ${state.panY}px) scale(${state.zoomLevel})`;

    if (canvas) {
      canvas.style.transform = transformVal;
      canvas.style.transformOrigin = '0 0';
    }
    if (previewCanvas) {
      previewCanvas.style.transform = transformVal;
      previewCanvas.style.transformOrigin = '0 0';
    }
    if (pdfCanvas) {
      pdfCanvas.style.transform = transformVal;
      pdfCanvas.style.transformOrigin = '0 0';
    }
    if (imageCanvas) {
      imageCanvas.style.transform = transformVal;
      imageCanvas.style.transformOrigin = '0 0';
    }
    const blocksLayer = document.getElementById('wbBlocksLayer');
    if (blocksLayer) {
      blocksLayer.style.transform = transformVal;
      blocksLayer.style.transformOrigin = '0 0';
    }
    if (selectionOverlay) {
      selectionOverlay.style.transform = transformVal;
      selectionOverlay.style.transformOrigin = '0 0';
    }
    invalidateCanvasRect();
  }

  /* ============================================================
     BACKGROUND PATTERNS & SUBJECT TEMPLATES
     ============================================================ */
  function setGridBackground(pattern) {
    state.gridPattern = pattern;
    markRecordingDirty();
    if (canvasContainer) {
      canvasContainer.className = 'wb-canvas-container grid-' + pattern;
      canvasContainer.setAttribute('data-surface', state.canvasSurface);
      let bg = '#ffffff';
      if (state.canvasSurface === 'chalkboard') bg = '#133827';
      else if (state.canvasSurface === 'blackboard') bg = '#18181b';
      else if (state.canvasSurface === 'cream') bg = '#fdfbf7';
      canvasContainer.style.backgroundColor = bg;
      canvasContainer.style.setProperty('--wb-canvas-bg', bg);
    }
    const gridSelect = document.getElementById('wbGridSelect');
    if (gridSelect && gridSelect.value !== pattern) {
      gridSelect.value = pattern;
    }
    updatePresBgActiveState(pattern);
    TeachingSession.logAction('whiteboard_background_change', { pattern: pattern });
    if (subjectDrawer) subjectDrawer.style.display = 'none';
    state.isSubjectDrawerOpen = false;
  }

  function renderGridOnCanvas(targetCtx, width, height, pattern) {
    const isDark = (state.canvasSurface === 'chalkboard' || state.canvasSurface === 'blackboard');
    const isCream = (state.canvasSurface === 'cream');

    if (pattern === 'dots') {
      targetCtx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.35)' : (isCream ? 'rgba(100, 116, 139, 0.4)' : '#94a3b8');
      for (let x = 12; x < width; x += 24) {
        for (let y = 12; y < height; y += 24) {
          targetCtx.beginPath();
          targetCtx.arc(x, y, 1.5, 0, Math.PI * 2);
          targetCtx.fill();
        }
      }
    } else if (pattern === 'math' || pattern === 'graph') {
      const step = pattern === 'graph' ? 14 : 24;
      if (isDark) {
        targetCtx.strokeStyle = pattern === 'graph' ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.2)';
      } else if (isCream) {
        targetCtx.strokeStyle = pattern === 'graph' ? 'rgba(148, 163, 184, 0.28)' : 'rgba(148, 163, 184, 0.38)';
      } else {
        targetCtx.strokeStyle = pattern === 'graph' ? '#e2e8f0' : '#cbd5e1';
      }
      targetCtx.lineWidth = 1;
      targetCtx.beginPath();
      for (let x = 0; x <= width; x += step) {
        targetCtx.moveTo(x, 0);
        targetCtx.lineTo(x, height);
      }
      for (let y = 0; y <= height; y += step) {
        targetCtx.moveTo(0, y);
        targetCtx.lineTo(width, y);
      }
      targetCtx.stroke();
    } else if (pattern === 'coord') {
      targetCtx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.18)' : (isCream ? 'rgba(148, 163, 184, 0.3)' : '#e2e8f0');
      targetCtx.lineWidth = 1;
      targetCtx.beginPath();
      for (let x = 0; x <= width; x += 24) {
        targetCtx.moveTo(x, 0); targetCtx.lineTo(x, height);
      }
      for (let y = 0; y <= height; y += 24) {
        targetCtx.moveTo(0, y); targetCtx.lineTo(width, y);
      }
      targetCtx.stroke();

      const cx = Math.round(width / 2);
      const cy = Math.round(height / 2);
      targetCtx.strokeStyle = isDark ? '#60a5fa' : '#2563eb';
      targetCtx.lineWidth = 2;
      targetCtx.beginPath();
      targetCtx.moveTo(0, cy); targetCtx.lineTo(width, cy);
      targetCtx.moveTo(cx, 0); targetCtx.lineTo(cx, height);
      targetCtx.stroke();
    } else if (pattern === 'numline') {
      const cy = Math.round(height / 2);
      targetCtx.strokeStyle = isDark ? '#f8fafc' : '#0f172a';
      targetCtx.lineWidth = 2;
      targetCtx.beginPath();
      targetCtx.moveTo(40, cy); targetCtx.lineTo(width - 40, cy);
      targetCtx.stroke();

      const step = (width - 80) / 20;
      for (let i = 0; i <= 20; i++) {
        const x = 40 + i * step;
        targetCtx.beginPath();
        targetCtx.moveTo(x, cy - 8); targetCtx.lineTo(x, cy + 8);
        targetCtx.stroke();
      }
    } else if (pattern === 'lines') {
      targetCtx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.22)' : (isCream ? 'rgba(148, 163, 184, 0.4)' : '#cbd5e1');
      targetCtx.lineWidth = 1;
      targetCtx.beginPath();
      for (let y = 32; y <= height; y += 32) {
        targetCtx.moveTo(0, y);
        targetCtx.lineTo(width, y);
      }
      targetCtx.stroke();
    }
  }

  /* ============================================================
     EDUCATIONAL IMAGE & DIAGRAM HANDLER (SAFE ERASER ARCHITECTURE)
     Rendered strictly to isolated #wbImageCanvas, physically
     immune to user ink erasures on #whiteboardCanvas.
     ============================================================ */
  function redrawImageCanvas() {
    if (!imageCanvas || !imageCtx) return;
    markRecordingDirty();
    const dpr = window.devicePixelRatio || 1;
    imageCtx.save();
    imageCtx.setTransform(1, 0, 0, 1, 0, 0);
    imageCtx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
    imageCtx.scale(dpr, dpr);

    if (state.loadedImages && state.loadedImages.length > 0) {
      state.loadedImages.forEach((item) => {
        imageCtx.drawImage(item.img, item.x, item.y, item.w, item.h);
      });
    }
    imageCtx.restore();
  }

  function handleImageUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    hideEmptyState();

    const reader = new FileReader();
    reader.onload = function (evt) {
      const img = new Image();
      img.onload = function () {
        const dpr = window.devicePixelRatio || 1;
        const canvasCssW = canvas.width / dpr;
        const maxW = canvasCssW * 0.75;
        const scale = img.width > maxW ? maxW / img.width : 1;
        const w = img.width * scale;
        const h = img.height * scale;

        if (!state.loadedImages) state.loadedImages = [];
        const imageItem = {
          id: 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          img,
          x: 40,
          y: 40,
          w,
          h,
          locked: false
        };
        state.loadedImages.push(imageItem);

        redrawImageCanvas();
        selectTool('select');
        selectObject({
          type: 'image',
          id: imageItem.id,
          ref: imageItem,
          bounds: { x: imageItem.x, y: imageItem.y, w: imageItem.w, h: imageItem.h },
          locked: false
        });
        saveState();

        TeachingMaterial.setMaterial('image', file.name, 1);
        TeachingSession.logAction('whiteboard_image_upload');
      };
      img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  /* ============================================================
     ROBUST LAZY PDF.JS INTEGRATION & MULTI-PAGE ANNOTATION
     ============================================================ */
  const PDFJS_LOCAL = './vendor/pdf.min.js';
  const PDFJS_WORKER_LOCAL = './vendor/pdf.worker.min.js';
  const PDFJS_CMAP_LOCAL = './vendor/cmaps/';
  const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
  const PDFJS_WORKER_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
  const PDFJS_CMAP_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/cmaps/';

  let isPdfEngineLoading = false;
  let pdfEngineCallbacks = [];

  function loadPdfEngine(onSuccess, onError) {
    if (typeof window.pdfjsLib !== 'undefined') {
      onSuccess();
      return;
    }

    pdfEngineCallbacks.push({ onSuccess, onError });
    if (isPdfEngineLoading) return;
    isPdfEngineLoading = true;

    function notifySuccess() {
      isPdfEngineLoading = false;
      const cbs = pdfEngineCallbacks.slice();
      pdfEngineCallbacks = [];
      cbs.forEach(cb => {
        try { cb.onSuccess(); } catch (e) { console.error('PDF engine success callback error:', e); }
      });
    }

    function notifyError(err) {
      isPdfEngineLoading = false;
      const cbs = pdfEngineCallbacks.slice();
      pdfEngineCallbacks = [];
      cbs.forEach(cb => {
        try { cb.onError(err); } catch (e) { console.error('PDF engine error callback error:', e); }
      });
    }

    function configureWorker(workerPath) {
      try {
        if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath;
        }
      } catch (e) {
        console.warn('PDF.js GlobalWorkerOptions workerSrc assignment warning:', e);
      }
    }

    // Phase 1: Try high-speed local project asset first (100% offline, zero network, zero CSP barrier)
    const scriptLocal = document.createElement('script');
    scriptLocal.src = PDFJS_LOCAL;
    scriptLocal.onload = () => {
      configureWorker(PDFJS_WORKER_LOCAL);
      notifySuccess();
    };
    scriptLocal.onerror = () => {
      console.warn('Local PDF.js vendor asset not reachable; falling back to CDN...');
      if (scriptLocal.parentNode) scriptLocal.parentNode.removeChild(scriptLocal);

      // Phase 2: Fallback to remote CDN if local is unavailable
      const scriptCdn = document.createElement('script');
      scriptCdn.src = PDFJS_CDN;
      scriptCdn.onload = () => {
        configureWorker(PDFJS_WORKER_CDN);
        notifySuccess();
      };
      scriptCdn.onerror = (cdnErr) => {
        console.error('Failed to load PDF engine from both local vendor and CDN:', cdnErr);
        if (scriptCdn.parentNode) scriptCdn.parentNode.removeChild(scriptCdn);
        notifyError(new Error('PDF engine script could not be loaded from local assets or remote CDN.'));
      };
      document.head.appendChild(scriptCdn);
    };
    document.head.appendChild(scriptLocal);
  }

  function loadPdfFile(file) {
    if (!file) return;

    if (file.type && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      alert('Please select a valid PDF document (.pdf).');
      return;
    }

    hideEmptyState();

    if (pageNumLabel) {
      pageNumLabel.textContent = 'Loading PDF...';
      if (pageNavGroup) pageNavGroup.style.display = 'flex';
    }

    loadPdfEngine(
      () => {
        initPdfRendering(file);
      },
      (err) => {
        alert('Could not initialize PDF engine: ' + (err && err.message ? err.message : 'Engine unavailable.'));
        if (pageNavGroup) pageNavGroup.style.display = 'none';
        if (pageNumLabel) pageNumLabel.textContent = 'PDF Error';
      }
    );
  }

  function initPdfRendering(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      const typedArray = new Uint8Array(e.target.result);

      const workerSrc = (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions && window.pdfjsLib.GlobalWorkerOptions.workerSrc) || '';
      const cMapUrl = workerSrc.includes('vendor') ? PDFJS_CMAP_LOCAL : PDFJS_CMAP_CDN;

      window.pdfjsLib.getDocument({
        data: typedArray,
        cMapUrl: cMapUrl,
        cMapPacked: true
      }).promise.then((pdf) => {
        state.pdfDoc = pdf;
        state.pdfTotalPages = pdf.numPages;
        state.pdfPageNum = 1;
        state.pageHistories = {};
        state.pdfLoaded = true;

        if (pageNavGroup) pageNavGroup.style.display = 'flex';
        renderPdfPage(1);

        TeachingMaterial.setMaterial('pdf', file.name, pdf.numPages, { pageCount: pdf.numPages });
        TeachingSession.logAction('whiteboard_pdf_upload', { pageCount: pdf.numPages });
      }).catch((err) => {
        alert('Could not open PDF file: ' + (err.message || 'Invalid or corrupted document.'));
        console.error('PDF.js getDocument Error:', err);
        if (pageNavGroup) pageNavGroup.style.display = 'none';
        if (pageNumLabel) pageNumLabel.textContent = 'PDF Error';
      });
    };

    reader.onerror = function () {
      alert('Failed to read the selected PDF file from your device.');
      if (pageNavGroup) pageNavGroup.style.display = 'none';
      if (pageNumLabel) pageNumLabel.textContent = 'Read Error';
    };

    reader.readAsArrayBuffer(file);
  }

  function saveCurrentPageAnnotations() {
    if (state.pdfLoaded && state.pdfPageNum) {
      state.pageHistories[state.pdfPageNum] = {
        stack: [...state.historyStack],
        index: state.historyIndex
      };
    }
  }

  function redrawPdfCanvas() {
    markRecordingDirty();
    if (!pdfCtx || !pdfCanvas || !state.currentPdfPageCanvas) return;
    const dpr = window.devicePixelRatio || 1;
    pdfCtx.save();
    pdfCtx.setTransform(1, 0, 0, 1, 0, 0);
    pdfCtx.clearRect(0, 0, pdfCanvas.width, pdfCanvas.height);

    const t = state.pdfMaterialTransform || {
      x: 0,
      y: 0,
      width: Math.round(pdfCanvas.width / dpr),
      height: Math.round(pdfCanvas.height / dpr),
      locked: false
    };

    const drawX = Math.round(t.x * dpr);
    const drawY = Math.round(t.y * dpr);
    const drawW = Math.round(t.width * dpr);
    const drawH = Math.round(t.height * dpr);

    // Teacher worksheet background with subtle drop shadow
    pdfCtx.fillStyle = '#ffffff';
    pdfCtx.shadowColor = 'rgba(15, 23, 42, 0.12)';
    pdfCtx.shadowBlur = 14 * dpr;
    pdfCtx.fillRect(drawX, drawY, drawW, drawH);
    pdfCtx.shadowColor = 'transparent';

    // Render PDF page onto underlay canvas
    pdfCtx.drawImage(state.currentPdfPageCanvas, drawX, drawY, drawW, drawH);
    pdfCtx.restore();

    pdfCtx.setTransform(1, 0, 0, 1, 0, 0);
    pdfCtx.scale(dpr, dpr);
    markRecordingDirty();
  }

  function renderPdfPage(num) {
    if (!state.pdfDoc) return;

    state.pdfPageNum = num;

    if (pageNumLabel) {
      pageNumLabel.textContent = `Page ${num} / ${state.pdfTotalPages}`;
    }
    if (firstPdfBtn) firstPdfBtn.disabled = num <= 1;
    if (prevPdfBtn) prevPdfBtn.disabled = num <= 1;
    if (nextPdfBtn) nextPdfBtn.disabled = num >= state.pdfTotalPages;
    if (lastPdfBtn) lastPdfBtn.disabled = num >= state.pdfTotalPages;

    updateDocumentHeaderInfo();

    state.pdfDoc.getPage(num).then((page) => {
      const dpr = window.devicePixelRatio || 1;
      const canvasCssW = canvas.width / dpr;
      const canvasCssH = canvas.height / dpr;

      // Fit worksheet proportionally inside canvas with comfortable margin
      const unscaledViewport = page.getViewport({ scale: 1.0 });
      const scaleX = (canvasCssW - 32) / unscaledViewport.width;
      const scaleY = (canvasCssH - 32) / unscaledViewport.height;
      const fitScale = Math.min(scaleX, scaleY);
      const viewport = page.getViewport({ scale: fitScale * dpr });

      const tempPdfCanvas = document.createElement('canvas');
      tempPdfCanvas.width = viewport.width;
      tempPdfCanvas.height = viewport.height;
      const tempPdfCtx = tempPdfCanvas.getContext('2d');

      page.render({
        canvasContext: tempPdfCtx,
        viewport: viewport
      }).promise.then(() => {
        // Cache rendered PDF page and initialize transform
        state.currentPdfPageCanvas = tempPdfCanvas;
        const initW = Math.round(tempPdfCanvas.width / dpr);
        const initH = Math.round(tempPdfCanvas.height / dpr);
        const initX = Math.round((canvasCssW - initW) / 2);
        const initY = Math.round((canvasCssH - initH) / 2);

        state.pdfMaterialTransform = {
          x: initX,
          y: initY,
          width: initW,
          height: initH,
          locked: false
        };

        redrawPdfCanvas();
        if (state.selectedObject && state.selectedObject.type === 'pdf') {
          updateSelectionOverlay();
        }

        // On the user drawing ink canvas (ctx), clear and restore the user's annotations for this page
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);

        if (state.pageHistories[num]) {
          state.historyStack = [...state.pageHistories[num].stack];
          state.historyIndex = state.pageHistories[num].index;
          if (state.historyStack[state.historyIndex]) {
            ctx.putImageData(state.historyStack[state.historyIndex], 0, 0);
          }
          updateUndoRedoUI();
        } else {
          state.historyStack = [];
          state.historyIndex = -1;
          saveState();
        }

        TeachingSession.logAction('pdf_page_view', { page: num });
      });
    }).catch((err) => {
      alert('Error rendering PDF page: ' + (err.message || 'Unknown error'));
      console.error(err);
    });
  }

  function firstPdfPage() {
    if (state.pdfDoc && state.pdfPageNum > 1) {
      saveCurrentPageAnnotations();
      renderPdfPage(1);
    }
  }

  function lastPdfPage() {
    if (state.pdfDoc && state.pdfPageNum < state.pdfTotalPages) {
      saveCurrentPageAnnotations();
      renderPdfPage(state.pdfTotalPages);
    }
  }

  function prevPdfPage() {
    if (state.pdfDoc && state.pdfPageNum > 1) {
      saveCurrentPageAnnotations();
      renderPdfPage(state.pdfPageNum - 1);
    }
  }

  function nextPdfPage() {
    if (state.pdfDoc && state.pdfPageNum < state.pdfTotalPages) {
      saveCurrentPageAnnotations();
      renderPdfPage(state.pdfPageNum + 1);
    }
  }

  /* ============================================================
     EXPORT & PRINT FUNCTIONS
     ============================================================ */
  function exportPNG() {
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const expCtx = exportCanvas.getContext('2d');

    // Layer 1: Classroom Surface Background Color
    let surfaceBg = '#ffffff';
    if (state.canvasSurface === 'chalkboard') surfaceBg = '#133827';
    else if (state.canvasSurface === 'blackboard') surfaceBg = '#18181b';
    else if (state.canvasSurface === 'cream') surfaceBg = '#fdfbf7';

    expCtx.fillStyle = surfaceBg;
    expCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    // Layer 2: Grid/Pattern (if not blank and no PDF loaded)
    if (!state.pdfLoaded) {
      renderGridOnCanvas(expCtx, exportCanvas.width, exportCanvas.height, state.gridPattern);
    }

    // Layer 3: PDF Underlay Layer (with Chalkboard mode filter if enabled)
    if (state.pdfLoaded && pdfCanvas) {
      if (state.pdfChalkboardMode) {
        expCtx.save();
        expCtx.filter = 'invert(0.92) hue-rotate(180deg) contrast(1.15) brightness(0.95)';
        expCtx.drawImage(pdfCanvas, 0, 0);
        expCtx.restore();
      } else {
        expCtx.drawImage(pdfCanvas, 0, 0);
      }
    }

    // Layer 4: Educational Images & Diagrams Underlay
    if (imageCanvas && imageCanvas.width > 0) {
      expCtx.drawImage(imageCanvas, 0, 0);
    }

    // Layer 5: Teacher Annotations, Drawings & Shapes
    expCtx.drawImage(canvas, 0, 0);

    const link = document.createElement('a');
    link.download = `VFF-Teaching-Studio-${Date.now()}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();

    TeachingSession.logAction('whiteboard_export_png');
  }

  function printBoard() {
    TeachingSession.logAction('whiteboard_print');
    window.print();
  }

  /* ============================================================
     TEACHING STUDIO RECORDING SYSTEM (PHASE 3)
     Browser-native, local-first lesson recording with multi-layer
     compositor, MediaRecorder, and optional microphone audio.
     Completely client-side: zero server upload, zero cloud storage.
     ============================================================ */

  function getSupportedRecordingMimeType() {
    const candidateTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=h264,opus',
      'video/webm',
      'video/mp4;codecs=avc1,mp4a.40.2',
      'video/mp4'
    ];

    if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
      for (let i = 0; i < candidateTypes.length; i++) {
        if (MediaRecorder.isTypeSupported(candidateTypes[i])) {
          return candidateTypes[i];
        }
      }
    }
    return '';
  }

  function getMimeTypeLabel(mime) {
    if (!mime) return 'WebM';
    if (mime.includes('vp9')) return 'WebM (VP9)';
    if (mime.includes('vp8')) return 'WebM (VP8)';
    if (mime.includes('h264') || mime.includes('avc')) {
      return mime.includes('mp4') ? 'MP4 (H.264)' : 'WebM (H.264)';
    }
    if (mime === 'video/mp4') return 'MP4';
    if (mime.startsWith('video/webm')) return 'WebM';
    return mime;
  }

  function updateRecordingUIState(isRec) {
    if (wbRecordBtn) {
      wbRecordBtn.classList.toggle('recording', isRec);
      wbRecordBtn.setAttribute('aria-label', isRec ? 'Stop local lesson recording' : 'Start local lesson recording');
      wbRecordBtn.setAttribute('title', isRec ? 'Stop recording teaching session' : 'Record teaching session locally (No upload to VFF)');
    }
    if (wbRecordBtnText) {
      wbRecordBtnText.textContent = isRec ? 'Stop Recording' : 'Record';
    }
    if (wbRecordingIndicator) {
      wbRecordingIndicator.style.display = isRec ? 'inline-flex' : 'none';
    }

    if (wbPresRecordBtn) {
      wbPresRecordBtn.classList.toggle('recording', isRec);
      wbPresRecordBtn.setAttribute('aria-label', isRec ? 'Stop local lesson recording' : 'Start local lesson recording');
      wbPresRecordBtn.setAttribute('title', isRec ? 'Stop recording teaching session' : 'Record teaching session locally');
    }
    if (wbPresRecordBtnText) {
      wbPresRecordBtnText.textContent = isRec ? 'Stop Recording' : 'Record';
    }
    if (wbPresRecordingIndicator) {
      wbPresRecordingIndicator.style.display = isRec ? 'inline-flex' : 'none';
    }
  }

  function startRecordingTimer() {
    stopRecordingTimer();
    let elapsedSec = 0;
    state.recordingTimerInterval = setInterval(() => {
      elapsedSec++;
      const mins = Math.floor(elapsedSec / 60);
      const secs = elapsedSec % 60;
      const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      if (wbRecordingTimer) wbRecordingTimer.textContent = timeStr;
      if (wbPresRecordingTimer) wbPresRecordingTimer.textContent = timeStr;
    }, 1000);
  }

  function stopRecordingTimer() {
    if (state.recordingTimerInterval) {
      clearInterval(state.recordingTimerInterval);
      state.recordingTimerInterval = null;
    }
    if (wbRecordingTimer) wbRecordingTimer.textContent = '00:00';
    if (wbPresRecordingTimer) wbPresRecordingTimer.textContent = '00:00';
  }

  function renderLessonBlocksOnCompositor(compCtx, offsetX, offsetY, scaleX, scaleY) {
    if (!state.lessonBlocks || state.lessonBlocks.length === 0) return;

    state.lessonBlocks.forEach((block) => {
      const bx = offsetX + block.x * scaleX;
      const by = offsetY + block.y * scaleY;
      const bw = (block.width || 240) * scaleX;
      const bh = (block.height || 140) * scaleY;

      compCtx.save();
      let bgColor = '#ffffff';
      let borderColor = '#cbd5e1';
      let titleColor = '#0f172a';

      if (block.type === 'note') {
        const c = block.data && block.data.color;
        if (c === 'yellow') bgColor = '#fef9c3';
        else if (c === 'blue') bgColor = '#dbeafe';
        else if (c === 'mint') bgColor = '#d1fae5';
        else if (c === 'pink') bgColor = '#fce7f3';
        else bgColor = '#fef08a';
        borderColor = '#94a3b8';
      } else if (block.type === 'reveal' || block.type === 'qa') {
        bgColor = '#ffffff';
        borderColor = '#3b82f6';
      } else if (block.type === 'concept') {
        bgColor = '#f8fafc';
        borderColor = '#2563eb';
      } else if (block.type === 'takeaway') {
        bgColor = '#fffbeb';
        borderColor = '#f59e0b';
      }

      // Draw rounded card rectangle
      compCtx.fillStyle = bgColor;
      compCtx.strokeStyle = borderColor;
      compCtx.lineWidth = Math.max(1, 1.5 * scaleX);

      compCtx.beginPath();
      const r = 8 * scaleX;
      compCtx.moveTo(bx + r, by);
      compCtx.lineTo(bx + bw - r, by);
      compCtx.quadraticCurveTo(bx + bw, by, bx + bw, by + r);
      compCtx.lineTo(bx + bw, by + bh - r);
      compCtx.quadraticCurveTo(bx + bw, by + bh, bx + bw - r, by + bh);
      compCtx.lineTo(bx + r, by + bh);
      compCtx.quadraticCurveTo(bx, by + bh, bx, by + bh - r);
      compCtx.lineTo(bx, by + r);
      compCtx.quadraticCurveTo(bx, by, bx + r, by);
      compCtx.closePath();
      compCtx.fill();
      compCtx.stroke();

      // Card Header / Title
      compCtx.fillStyle = titleColor;
      compCtx.font = `bold ${Math.max(10, 13 * scaleX)}px Inter, sans-serif`;
      const titleText = (block.data && (block.data.title || block.data.question)) || (block.type.toUpperCase());
      compCtx.fillText(titleText.slice(0, 30), bx + 10 * scaleX, by + 18 * scaleY);

      // Card Body / Content Text
      compCtx.fillStyle = '#334155';
      compCtx.font = `${Math.max(9, 12 * scaleX)}px Inter, sans-serif`;
      let bodyText = '';
      if (block.type === 'note') {
        bodyText = (block.data && block.data.text) || '';
      } else if (block.type === 'reveal' || block.type === 'qa') {
        bodyText = (block.data && block.data.revealed) ? `Answer: ${block.data.answer || ''}` : '[Hidden Answer]';
      } else if (block.type === 'concept') {
        bodyText = (block.data && block.data.body) || '';
      } else if (block.type === 'takeaway') {
        bodyText = (block.data && block.data.text) || '';
      } else if (block.type === 'stamp') {
        bodyText = `${(block.data && block.data.icon) || ''} ${(block.data && block.data.text) || ''}`;
      } else if (block.type === 'infographic') {
        bodyText = (block.data && block.data.nodes) ? block.data.nodes.join(' → ') : '';
      }

      // Simple multi-line text wrap
      const words = bodyText.split(' ');
      let line = '';
      let lineY = by + 36 * scaleY;
      const maxWidth = bw - 20 * scaleX;
      const lineHeight = 16 * scaleY;

      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = compCtx.measureText(testLine);
        if (metrics.width > maxWidth && n > 0) {
          compCtx.fillText(line, bx + 10 * scaleX, lineY);
          line = words[n] + ' ';
          lineY += lineHeight;
          if (lineY > by + bh - 10 * scaleY) break;
        } else {
          line = testLine;
        }
      }
      if (line && lineY <= by + bh - 10 * scaleY) {
        compCtx.fillText(line, bx + 10 * scaleX, lineY);
      }

      compCtx.restore();
    });
  }

  /* ============================================================
     PHASE 3.1 / P1: COMPOSITOR 30 FPS THROTTLING & DIRTY-FLAG BYPASS
     ============================================================ */
  const RECORDING_FRAME_INTERVAL_MS = 1000 / 30; // ~33.33ms (Target 30 FPS for captureStream)
  const RECORDING_THROTTLE_TOLERANCE_MS = 2.0; // Phase jitter threshold (~31.33ms) for 60Hz/120Hz/144Hz displays
  const RECORDING_HEARTBEAT_INTERVAL_MS = 1000; // 1s keep-alive heartbeat to prevent captureStream/MediaRecorder starvation

  function markRecordingDirty() {
    state.recordingIsDirty = true;
  }

  function renderRecordingCompositorFrame() {
    if (!state.recordingCompositorCanvas || !state.recordingCompositorCtx) return;
    const compCtx = state.recordingCompositorCtx;
    const targetW = 1920;
    const targetH = 1080;

    const clientW = (canvasContainer && canvasContainer.clientWidth) || canvas.width || 1280;
    const clientH = (canvasContainer && canvasContainer.clientHeight) || canvas.height || 720;
    const srcAspect = clientW / clientH;
    const targetAspect = targetW / targetH; // 16:9

    let drawW = targetW;
    let drawH = targetH;
    let offsetX = 0;
    let offsetY = 0;

    if (srcAspect > targetAspect) {
      drawW = targetW;
      drawH = targetW / srcAspect;
      offsetY = (targetH - drawH) / 2;
    } else {
      drawH = targetH;
      drawW = targetH * srcAspect;
      offsetX = (targetW - drawW) / 2;
    }

    const scaleX = drawW / clientW;
    const scaleY = drawH / clientH;

    // Layer 1: Classroom Surface Background Color
    let bg = '#ffffff';
    if (state.canvasSurface === 'chalkboard') bg = '#133827';
    else if (state.canvasSurface === 'blackboard') bg = '#18181b';
    else if (state.canvasSurface === 'cream') bg = '#fdfbf7';

    compCtx.fillStyle = bg;
    compCtx.fillRect(0, 0, targetW, targetH);

    // Layer 2: Grid / Canvas Pattern
    if (!state.pdfLoaded && state.gridPattern && state.gridPattern !== 'blank') {
      compCtx.save();
      compCtx.beginPath();
      compCtx.rect(offsetX, offsetY, drawW, drawH);
      compCtx.clip();
      compCtx.translate(offsetX, offsetY);
      renderGridOnCanvas(compCtx, drawW, drawH, state.gridPattern);
      compCtx.restore();
    }

    // Layer 3: Dedicated PDF Underlay Canvas (with Chalkboard mode filter if active)
    if (state.pdfLoaded && pdfCanvas && pdfCanvas.width > 0) {
      if (state.pdfChalkboardMode) {
        compCtx.save();
        compCtx.filter = 'invert(0.92) hue-rotate(180deg) contrast(1.15) brightness(0.95)';
        compCtx.drawImage(pdfCanvas, offsetX, offsetY, drawW, drawH);
        compCtx.restore();
      } else {
        compCtx.drawImage(pdfCanvas, offsetX, offsetY, drawW, drawH);
      }
    }

    // Layer 4: Dedicated Educational Image & Diagram Underlay Canvas
    if (imageCanvas && imageCanvas.width > 0) {
      compCtx.drawImage(imageCanvas, offsetX, offsetY, drawW, drawH);
    }

    // Layer 4.5: Active Transient Preview (Highlighter under ink)
    if (previewCanvas && previewCanvas.style.display !== 'none') {
      compCtx.drawImage(previewCanvas, offsetX, offsetY, drawW, drawH);
    }

    // Layer 5: Interactive Teaching Ink, Shapes & Annotations Canvas
    if (canvas && canvas.width > 0) {
      compCtx.drawImage(canvas, offsetX, offsetY, drawW, drawH);
    }

    // Layer 6: Movable Lesson Blocks Layer
    renderLessonBlocksOnCompositor(compCtx, offsetX, offsetY, scaleX, scaleY);

    // Layer 7: Presentation Overlays (Spotlight & Laser)
    if (state.isSpotlightActive && spotlightCanvas && spotlightCanvas.style.display !== 'none') {
      compCtx.drawImage(spotlightCanvas, offsetX, offsetY, drawW, drawH);
    }
    if (state.isLaserActive && laserCanvas && laserCanvas.style.display !== 'none') {
      compCtx.drawImage(laserCanvas, offsetX, offsetY, drawW, drawH);
    }

    // Layer 8: Active Pointer Indicator (when active)
    if (state.isPointerOnCanvas && state.lastPointerX !== undefined && state.lastPointerY !== undefined) {
      const dpr = window.devicePixelRatio || 1;
      const cssCanvasW = canvas.width / dpr;
      const cssCanvasH = canvas.height / dpr;
      const pX = offsetX + (state.lastPointerX / cssCanvasW) * drawW;
      const pY = offsetY + (state.lastPointerY / cssCanvasH) * drawH;
      compCtx.save();
      compCtx.beginPath();
      compCtx.arc(pX, pY, 5, 0, Math.PI * 2);
      compCtx.fillStyle = '#ef4444';
      compCtx.fill();
      compCtx.strokeStyle = '#ffffff';
      compCtx.lineWidth = 1.5;
      compCtx.stroke();
      compCtx.restore();
    }
  }

  function renderRecordingFrameLoop(timestamp) {
    if (!state.isRecording) return;

    // requestAnimationFrame passes a DOMHighResTimeStamp (matching performance.now())
    const now = typeof timestamp === 'number' ? timestamp : performance.now();
    const elapsedSinceLastRender = now - state.lastRecordingFrameTime;

    // P1.1: 30 FPS Timestamp-Based Compositor Throttling
    if (elapsedSinceLastRender >= (RECORDING_FRAME_INTERVAL_MS - RECORDING_THROTTLE_TOLERANCE_MS)) {
      const elapsedSinceLastHeartbeat = now - state.lastRecordingHeartbeatTime;
      const shouldRender = state.recordingIsDirty || elapsedSinceLastHeartbeat >= RECORDING_HEARTBEAT_INTERVAL_MS;

      // P1.2: Dirty-Flag Idle Compositor Bypass with Conservative Stream Heartbeat
      if (shouldRender) {
        renderRecordingCompositorFrame();
        state.recordingIsDirty = false;
        state.lastRecordingFrameTime = now;
        state.lastRecordingHeartbeatTime = now;
      }
    }

    state.recordingRafId = requestAnimationFrame(renderRecordingFrameLoop);
  }

  function generateRecordingFilename(mimeType) {
    let ext = 'webm';
    if (mimeType && mimeType.toLowerCase().includes('mp4')) {
      ext = 'mp4';
    }
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const y = now.getFullYear();
    const m = pad(now.getMonth() + 1);
    const d = pad(now.getDate());
    const h = pad(now.getHours());
    const min = pad(now.getMinutes());
    return `VFF-Teaching-Studio-${y}-${m}-${d}-${h}-${min}.${ext}`;
  }

  function showRecordingToast(msg, isSuccess = true) {
    let toast = document.getElementById('wbRecordingToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'wbRecordingToast';
      document.body.appendChild(toast);
    }
    toast.className = isSuccess ? 'wb-rec-toast visible' : 'wb-rec-toast warn visible';
    toast.innerHTML = `<i class="fas ${isSuccess ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> <span>${msg}</span>`;
    setTimeout(() => {
      if (toast) toast.classList.remove('visible');
    }, 4500);
  }

  function autoDownloadRecording(blob, mimeType) {
    let downloadUrl = null;
    try {
      downloadUrl = URL.createObjectURL(blob);
      const filename = generateRecordingFilename(mimeType);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();

      // Non-blocking toast confirmation
      showRecordingToast('Recording saved to your Downloads.', true);

      // Clean up the temporary download link and revoke download URL
      setTimeout(() => {
        try {
          if (a.parentNode) {
            document.body.removeChild(a);
          }
          if (downloadUrl) {
            URL.revokeObjectURL(downloadUrl);
          }
        } catch (cleanErr) {
          console.warn('Cleanup download anchor error:', cleanErr);
        }
      }, 3000);
      return true;
    } catch (err) {
      console.warn('Automatic recording download failed or blocked:', err);
      showRecordingToast('Recording is ready. Use Download to save it.', false);
      if (downloadUrl) {
        try { URL.revokeObjectURL(downloadUrl); } catch (e) {}
      }
      return false;
    }
  }

  async function startRecording() {
    if (state.isRecording) return;

    // Clean up any previous session resources to ensure clean isolation
    closeRecordingModal();
    if (state.recordedUrl) {
      URL.revokeObjectURL(state.recordedUrl);
      state.recordedUrl = null;
    }
    state.recordedBlob = null;
    state.recordedChunks = [];

    if (typeof MediaRecorder === 'undefined') {
      alert('Lesson recording is not supported in this browser. Please use Google Chrome or a modern Chromium browser.');
      return;
    }

    const mimeType = getSupportedRecordingMimeType();
    if (!mimeType) {
      alert('No supported video recording format was detected in this browser.');
      return;
    }
    state.recordingMimeType = mimeType;

    // Initialize Offscreen Compositor Canvas (Target 1920x1080)
    if (!state.recordingCompositorCanvas) {
      state.recordingCompositorCanvas = document.createElement('canvas');
    }
    state.recordingCompositorCanvas.width = 1920;
    state.recordingCompositorCanvas.height = 1080;
    state.recordingCompositorCtx = state.recordingCompositorCanvas.getContext('2d');

    // Initial frame render so stream starts immediately with valid content
    state.recordingIsDirty = true;
    renderRecordingCompositorFrame();
    state.lastRecordingFrameTime = performance.now();
    state.lastRecordingHeartbeatTime = performance.now();
    state.recordingIsDirty = false;

    let stream;
    try {
      stream = state.recordingCompositorCanvas.captureStream(30);
    } catch (err) {
      console.error('Error starting canvas captureStream:', err);
      alert('Could not initialize video recording stream.');
      return;
    }

    // Optional user-controlled microphone audio (Default OFF)
    state.recordingHasAudio = false;
    state.recordingAudioStream = null;
    if (wbRecordMicCheckbox && wbRecordMicCheckbox.checked) {
      if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          const audioTracks = audioStream.getAudioTracks();
          if (audioTracks && audioTracks.length > 0) {
            stream.addTrack(audioTracks[0]);
            state.recordingAudioStream = audioStream;
            state.recordingHasAudio = true;
          }
        } catch (micErr) {
          console.warn('Microphone permission denied or unavailable:', micErr);
          alert('Microphone access was denied or unavailable. Recording will proceed with video only.');
        }
      }
    }

    // Initialize MediaRecorder
    state.recordedChunks = [];
    try {
      const options = { mimeType };
      state.mediaRecorder = new MediaRecorder(stream, options);
    } catch (mrErr) {
      console.warn('MediaRecorder init with detected mimeType failed, trying browser default:', mrErr);
      try {
        state.mediaRecorder = new MediaRecorder(stream);
        state.recordingMimeType = state.mediaRecorder.mimeType || 'video/webm';
      } catch (fallbackErr) {
        console.error('MediaRecorder initialization failed:', fallbackErr);
        alert('Failed to initialize browser MediaRecorder.');
        return;
      }
    }

    state.mediaRecorder.ondataavailable = function (e) {
      if (e.data && e.data.size > 0) {
        state.recordedChunks.push(e.data);
      }
    };

    state.mediaRecorder.onstop = function () {
      const durationSec = Math.round((Date.now() - state.recordingStartTime) / 1000);
      state.recordingDurationSec = durationSec;

      // Release microphone tracks immediately
      if (state.recordingAudioStream) {
        try {
          state.recordingAudioStream.getTracks().forEach((t) => t.stop());
        } catch (tErr) {
          console.warn('Error stopping audio track:', tErr);
        }
        state.recordingAudioStream = null;
      }

      const finalMime = state.recordingMimeType || 'video/webm';
      const blob = new Blob(state.recordedChunks, { type: finalMime });
      state.recordedBlob = blob;

      // Automatically trigger browser download of completed recording
      const autoDownloadSuccess = autoDownloadRecording(blob, finalMime);

      // Display review modal with playback, duration, and manual download/delete options
      showRecordingModal(blob, durationSec, autoDownloadSuccess);

      // Log structural signal only (Zero raw video/audio/content bytes)
      let durationBucket = '<30s';
      if (durationSec >= 900) durationBucket = '>15m';
      else if (durationSec >= 300) durationBucket = '5m-15m';
      else if (durationSec >= 120) durationBucket = '2m-5m';
      else if (durationSec >= 30) durationBucket = '30s-2m';

      if (typeof PedagogicalSignal !== 'undefined' && PedagogicalSignal.record) {
        PedagogicalSignal.record('recording_stopped', {
          durationBucket: durationBucket,
          presentationMode: !!state.isPresentationMode
        }, 'structural');
      }
      TeachingSession.logAction('whiteboard_recording_stop', {
        durationBucket: durationBucket,
        presentationMode: !!state.isPresentationMode
      });
    };

    // Start MediaRecorder with 1000ms chunk intervals
    state.mediaRecorder.start(1000);
    state.isRecording = true;
    state.recordingStartTime = Date.now();

    // Update UI to recording state
    updateRecordingUIState(true);

    // Start timer interval
    startRecordingTimer();

    // Start compositor render loop
    renderRecordingFrameLoop();

    // Log structural Genome signal only
    if (typeof PedagogicalSignal !== 'undefined' && PedagogicalSignal.record) {
      PedagogicalSignal.record('recording_started', {
        hasAudio: !!state.recordingHasAudio,
        presentationMode: !!state.isPresentationMode
      }, 'structural');
    }
    TeachingSession.logAction('whiteboard_recording_start', {
      hasAudio: !!state.recordingHasAudio,
      presentationMode: !!state.isPresentationMode
    });
  }

  function stopRecording() {
    if (!state.isRecording) return;
    state.isRecording = false;
    state.recordingIsDirty = false;

    // Stop compositor render loop
    if (state.recordingRafId) {
      cancelAnimationFrame(state.recordingRafId);
      state.recordingRafId = null;
    }

    // Stop timer interval
    stopRecordingTimer();

    // Stop MediaRecorder (triggers onstop)
    if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
      try {
        state.mediaRecorder.stop();
      } catch (err) {
        console.warn('Error stopping MediaRecorder:', err);
      }
    }

    // Update UI
    updateRecordingUIState(false);
  }

  function toggleRecording() {
    if (state.isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }

  function showRecordingModal(blob, durationSec, autoDownloadSuccess = true) {
    if (!wbRecordingModal) return;

    // Revoke previous playback URL to prevent memory leaks across sessions
    if (state.recordedUrl) {
      URL.revokeObjectURL(state.recordedUrl);
      state.recordedUrl = null;
    }

    const url = URL.createObjectURL(blob);
    state.recordedUrl = url;

    if (wbRecVideoPlayer) {
      wbRecVideoPlayer.src = url;
      wbRecVideoPlayer.load();
    }

    // Format duration MM:SS
    const mins = Math.floor(durationSec / 60);
    const secs = durationSec % 60;
    const durationStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    if (wbRecDurationLabel) {
      wbRecDurationLabel.textContent = durationStr;
    }

    // Format badge with actual detected MIME type
    if (wbRecFormatLabel) {
      wbRecFormatLabel.textContent = getMimeTypeLabel(state.recordingMimeType);
    }

    // Audio status
    if (wbRecAudioLabel) {
      wbRecAudioLabel.textContent = state.recordingHasAudio ? 'Microphone Included' : 'Visual Only';
    }

    // Status banner inside modal
    const noticeEl = document.getElementById('wbRecDownloadNotice');
    const noticeText = document.getElementById('wbRecDownloadNoticeText');
    const noticeIcon = document.getElementById('wbRecDownloadNoticeIcon');
    if (noticeEl && noticeText) {
      noticeEl.style.display = 'flex';
      if (autoDownloadSuccess !== false) {
        noticeEl.className = 'wb-rec-download-notice';
        if (noticeIcon) noticeIcon.className = 'fas fa-check-circle';
        noticeText.textContent = 'Recording saved to your Downloads.';
      } else {
        noticeEl.className = 'wb-rec-download-notice notice-warn';
        if (noticeIcon) noticeIcon.className = 'fas fa-exclamation-circle';
        noticeText.textContent = 'Recording is ready. Use Download to save it.';
      }
    }

    // Manual Download button (Allows teacher to download another copy without triggering double downloads)
    if (wbRecDownloadBtn) {
      const filename = generateRecordingFilename(state.recordingMimeType);
      wbRecDownloadBtn.href = url;
      wbRecDownloadBtn.download = filename;
    }

    wbRecordingModal.style.display = 'flex';
  }

  function closeRecordingModal() {
    if (wbRecordingModal) {
      wbRecordingModal.style.display = 'none';
    }
    if (wbRecVideoPlayer) {
      wbRecVideoPlayer.pause();
    }
  }

  function deleteRecording() {
    if (state.recordedUrl) {
      URL.revokeObjectURL(state.recordedUrl);
      state.recordedUrl = null;
    }
    if (wbRecVideoPlayer) {
      wbRecVideoPlayer.pause();
      wbRecVideoPlayer.removeAttribute('src');
      wbRecVideoPlayer.load();
    }
    state.recordedBlob = null;
    state.recordedChunks = [];
    closeRecordingModal();
  }

  function initRecordingUI() {
    if (wbRecordBtn) {
      wbRecordBtn.addEventListener('click', toggleRecording);
    }
    if (wbPresRecordBtn) {
      wbPresRecordBtn.addEventListener('click', toggleRecording);
    }
    if (wbRecCloseBtn) {
      wbRecCloseBtn.addEventListener('click', closeRecordingModal);
    }
    if (wbRecDeleteBtn) {
      wbRecDeleteBtn.addEventListener('click', deleteRecording);
    }
    if (wbRecPlayBtn && wbRecVideoPlayer) {
      wbRecPlayBtn.addEventListener('click', () => {
        wbRecVideoPlayer.play();
      });
    }
    if (wbRecordingModal) {
      wbRecordingModal.addEventListener('click', (e) => {
        if (e.target === wbRecordingModal) {
          closeRecordingModal();
        }
      });
    }
  }

  /* ============================================================
     UI BINDINGS & CONTROLS SETUP
     ============================================================ */
  function selectTool(toolName) {
    state.currentTool = toolName;
    const allToolBtns = document.querySelectorAll('.wb-tool-btn[data-tool]');
    allToolBtns.forEach((b) => {
      if (b.getAttribute('data-tool') === toolName) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });

    if (canvas) {
      if (toolName === 'select') {
        canvas.classList.add('select-mode');
        canvas.classList.remove('pan-mode');
      } else if (toolName === 'pan') {
        canvas.classList.add('pan-mode');
        canvas.classList.remove('select-mode');
        deselectObject();
      } else {
        canvas.classList.remove('select-mode');
        canvas.classList.remove('pan-mode');
        deselectObject();
      }
    }

    if (toolName === 'eraser') {
      updateEraserCursor();
    } else if (canvas) {
      canvas.style.cursor = '';
    }

    if (isShapeTool(toolName)) {
      toggleShapesPopover(false);
      toggleMathPopover(false);
    }

    if (state.currentTool !== 'text' && state.isEditingText) {
      commitDirectText();
    }
  }

  // Unified Color Selection (Toolbar Swatches & Presentation Tool Panel Dots)
  function setStrokeColor(color) {
    state.strokeColor = color;
    const allSwatches = document.querySelectorAll('.wb-swatch');
    allSwatches.forEach((s) => {
      s.classList.toggle('active', s.getAttribute('data-color') === color);
    });
    const allPresDots = document.querySelectorAll('.wb-pres-color-dot');
    allPresDots.forEach((d) => {
      d.classList.toggle('active', d.getAttribute('data-color') === color);
    });
    const cp = document.getElementById('wbColorPicker');
    if (cp && cp.value !== color && color.startsWith('#') && color.length === 7) {
      cp.value = color;
    }
    updateStrokePreview();
  }

  /* ============================================================
     CLASSROOM SURFACES ARCHITECTURE (PHASE 2.5)
     ============================================================ */
  function setCanvasSurface(surface) {
    if (!['white', 'chalkboard', 'blackboard', 'cream'].includes(surface)) return;
    state.canvasSurface = surface;
    markRecordingDirty();

    let bg = '#ffffff';
    if (surface === 'chalkboard') bg = '#133827';
    else if (surface === 'blackboard') bg = '#18181b';
    else if (surface === 'cream') bg = '#fdfbf7';

    if (canvasContainer) {
      canvasContainer.setAttribute('data-surface', surface);
      canvasContainer.style.backgroundColor = bg;
      canvasContainer.style.setProperty('--wb-canvas-bg', bg);
    }

    const workspaceGrid = document.querySelector('.wb-workspace-grid');
    if (workspaceGrid) {
      workspaceGrid.style.setProperty('--wb-canvas-bg', bg);
    }

    const surfSel = document.getElementById('wbSurfaceSelect');
    if (surfSel && surfSel.value !== surface) {
      surfSel.value = surface;
    }

    // Sync presentation surface popover items
    document.querySelectorAll('[data-pres-surface], [data-surface], .wb-pres-surface-item').forEach((item) => {
      const s = item.getAttribute('data-pres-surface') || item.getAttribute('data-surface');
      item.classList.toggle('active', s === surface);
    });

    // SMART INK ADAPTATION (Phase 2.5 Rule 3):
    // Smart ink adaptation must never aggressively override an explicitly chosen teacher colour
    // without a clear reason. It provides a safe default when switching to a dark surface.
    const isDark = (surface === 'chalkboard' || surface === 'blackboard');
    if (isDark) {
      // If currently using dark slate or pure black which would blend into dark surface:
      if (state.strokeColor === '#0f172a' || state.strokeColor === '#000000' || state.strokeColor === '#1e293b') {
        setStrokeColor('#ffffff'); // Chalk White
      }
    } else {
      // Switching to a light surface (white or cream):
      // If currently using pure white ink which would be invisible on white/cream:
      if (state.strokeColor === '#ffffff') {
        setStrokeColor('#0f172a'); // Dark Slate
      }
    }

    // Project Genome structural telemetry signal (Rule L)
    if (PedagogicalSignal && typeof PedagogicalSignal.record === 'function') {
      PedagogicalSignal.record('surface_changed', { surface: surface }, 'pedagogical_structure');
    }
    TeachingSession.logAction('whiteboard_surface_change', { surface: surface });
  }

  function togglePdfChalkboardMode(forcedState) {
    state.pdfChalkboardMode = (forcedState !== undefined) ? forcedState : !state.pdfChalkboardMode;
    markRecordingDirty();
    if (pdfCanvas) {
      pdfCanvas.classList.toggle('chalkboard-mode', state.pdfChalkboardMode);
    }
    const pdfCbBtn = document.getElementById('wbPdfChalkboardBtn');
    if (pdfCbBtn) pdfCbBtn.classList.toggle('active', state.pdfChalkboardMode);
    const presPdfCbBtn = document.getElementById('wbPresPdfChalkboardBtn');
    if (presPdfCbBtn) presPdfCbBtn.classList.toggle('active', state.pdfChalkboardMode);

    if (PedagogicalSignal && typeof PedagogicalSignal.record === 'function') {
      PedagogicalSignal.record('pdf_chalkboard_mode_toggled', { enabled: state.pdfChalkboardMode }, 'pedagogical_structure');
    }
    TeachingSession.logAction('pdf_chalkboard_mode_toggle', { enabled: state.pdfChalkboardMode });
  }

  function toggleStylusOnly(forcedState) {
    state.stylusOnlyMode = (forcedState !== undefined) ? forcedState : !state.stylusOnlyMode;
    const stylusBtn = document.getElementById('wbStylusOnlyBtn');
    if (stylusBtn) {
      stylusBtn.classList.toggle('active', state.stylusOnlyMode);
      stylusBtn.title = state.stylusOnlyMode ? 'Stylus Only: ON (Accidental touch drawing suppressed)' : 'Stylus Only (Ignore touch drawing)';
    }
    const presStyBtn = document.getElementById('wbPresStylusBtn');
    if (presStyBtn) {
      presStyBtn.classList.toggle('active', state.stylusOnlyMode);
      presStyBtn.title = state.stylusOnlyMode ? 'Stylus Only: ON' : 'Stylus Only';
    }

    if (PedagogicalSignal && typeof PedagogicalSignal.record === 'function') {
      PedagogicalSignal.record('stylus_only_toggled', { enabled: state.stylusOnlyMode }, 'pedagogical_structure');
    }
    TeachingSession.logAction('stylus_only_toggle', { enabled: state.stylusOnlyMode });
  }

  function toggleLineStyle(forcedStyle) {
    state.lineStyle = forcedStyle || (state.lineStyle === 'solid' ? 'dashed' : 'solid');
    const lsBtn = document.getElementById('wbLineStyleBtn');
    if (lsBtn) {
      if (state.lineStyle === 'dashed') {
        lsBtn.innerHTML = '<i class="fas fa-ellipsis-h"></i> Dashed';
        lsBtn.classList.add('active');
        lsBtn.title = 'Line Style: Dashed (Click for Solid)';
      } else {
        lsBtn.innerHTML = '<i class="fas fa-minus"></i> Solid';
        lsBtn.classList.remove('active');
        lsBtn.title = 'Line Style: Solid (Click for Dashed)';
      }
    }
  }

  function setupUIControls() {
    // Upgraded Hero Section CTAs & Feature Chips (Phase 2A)
    const heroStartBtn = document.getElementById('wbHeroStartTeachingBtn');
    if (heroStartBtn) {
      heroStartBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const appWrapper = document.getElementById('whiteboardApp');
        if (appWrapper) {
          appWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
          selectTool('pen');
        }
      });
    }

    const heroExploreBtn = document.getElementById('wbHeroExploreToolsBtn');
    if (heroExploreBtn) {
      heroExploreBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const appWrapper = document.getElementById('whiteboardApp');
        if (appWrapper) {
          appWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        toggleSubjectDrawer(true);
      });
    }

    const heroSubjectChips = document.querySelectorAll('.wb-hero-chip[data-subject]');
    heroSubjectChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const subject = chip.getAttribute('data-subject');
        if (subject && typeof setSubjectMode === 'function') {
          setSubjectMode(subject);
        }
        const appWrapper = document.getElementById('whiteboardApp');
        if (appWrapper) {
          appWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    const heroPresChip = document.querySelector('.wb-hero-chip[data-action="presentation"]');
    if (heroPresChip) {
      heroPresChip.addEventListener('click', () => {
        togglePresentationMode(true);
      });
    }

    // Toolbar Tool Selection
    const toolBtns = document.querySelectorAll('.wb-tool-btn[data-tool]');
    toolBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        selectTool(btn.getAttribute('data-tool'));
      });
    });

    // Phase 2.8 Shapes Popover Trigger Button
    if (shapesBtn) {
      shapesBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleShapesPopover();
      });
    }

    // Phase 2.8 Math Tools Popover Trigger Button
    if (mathBtn) {
      mathBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMathPopover();
      });
    }

    // Phase 2.8 Popover Shape & Math Buttons
    const shapeBtns = document.querySelectorAll('.wb-shape-btn[data-shape]');
    shapeBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const s = btn.getAttribute('data-shape');
        if (s) {
          selectTool(s);
          toggleShapesPopover(false);
          toggleMathPopover(false);
        }
      });
    });

    // Subject Mode Native Dropdown Sync
    if (subjectSelect) {
      subjectSelect.addEventListener('change', (e) => {
        setSubjectMode(e.target.value);
      });
    }

    // Custom Subject Switcher Trigger Button
    const subjectSwitcherBtn = document.getElementById('wbSubjectSwitcherBtn');
    if (subjectSwitcherBtn) {
      subjectSwitcherBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSubjectDropdown();
      });
    }

    // Classroom Surface Selection
    const surfaceSelectEl = document.getElementById('wbSurfaceSelect');
    if (surfaceSelectEl) {
      surfaceSelectEl.addEventListener('change', (e) => {
        setCanvasSurface(e.target.value);
      });
    }

    // Presentation Mode Surface Popover Items
    const presSurfaceItems = document.querySelectorAll('[data-pres-surface], [data-surface], .wb-pres-surface-item');
    presSurfaceItems.forEach((item) => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const surface = item.getAttribute('data-pres-surface') || item.getAttribute('data-surface');
        if (surface) {
          setCanvasSurface(surface);
          togglePresBgMenu(false);
        }
      });
    });

    // Line Style Toggle Button
    const lineStyleBtnEl = document.getElementById('wbLineStyleBtn');
    if (lineStyleBtnEl) {
      lineStyleBtnEl.addEventListener('click', () => {
        toggleLineStyle();
      });
    }

    // Stylus Only Palm Rejection Toggle Buttons
    const stylusOnlyBtnEl = document.getElementById('wbStylusOnlyBtn');
    if (stylusOnlyBtnEl) {
      stylusOnlyBtnEl.addEventListener('click', () => {
        toggleStylusOnly();
      });
    }
    const presStylusBtnEl = document.getElementById('wbPresStylusBtn');
    if (presStylusBtnEl) {
      presStylusBtnEl.addEventListener('click', () => {
        toggleStylusOnly();
      });
    }

    // PDF Chalkboard Invert Mode Buttons
    const pdfCbBtnEl = document.getElementById('wbPdfChalkboardBtn');
    if (pdfCbBtnEl) {
      pdfCbBtnEl.addEventListener('click', () => {
        togglePdfChalkboardMode();
      });
    }
    const presPdfCbBtnEl = document.getElementById('wbPresPdfChalkboardBtn');
    if (presPdfCbBtnEl) {
      presPdfCbBtnEl.addEventListener('click', () => {
        togglePdfChalkboardMode();
      });
    }

    const swatches = document.querySelectorAll('.wb-swatch');
    swatches.forEach((swatch) => {
      swatch.addEventListener('click', () => {
        const c = swatch.getAttribute('data-color');
        if (c) setStrokeColor(c);
      });
    });

    const presColorDots = document.querySelectorAll('.wb-pres-color-dot');
    presColorDots.forEach((dot) => {
      dot.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const c = dot.getAttribute('data-color');
        if (c) setStrokeColor(c);
      });
    });

    // Custom Color Picker Input
    const colorPicker = document.getElementById('wbColorPicker');
    if (colorPicker) {
      colorPicker.addEventListener('input', (e) => {
        state.strokeColor = e.target.value;
        swatches.forEach((s) => s.classList.remove('active'));
        presColorDots.forEach((d) => d.classList.remove('active'));
        updateStrokePreview();
      });
    }

    // Stroke Size Slider
    const strokeSlider = document.getElementById('wbStrokeWidth');
    if (strokeSlider) {
      strokeSlider.addEventListener('input', (e) => {
        state.strokeWidth = parseInt(e.target.value, 10);
        updateStrokePreview();
      });
    }

    // Grid Selector
    const gridSelect = document.getElementById('wbGridSelect');
    if (gridSelect) {
      gridSelect.addEventListener('change', (e) => {
        setGridBackground(e.target.value);
      });
    }

    // Image & PDF Inputs
    const imgInput = document.getElementById('wbImgInput');
    if (imgInput) imgInput.addEventListener('change', handleImageUpload);

    const pdfInput = document.getElementById('wbPdfInput');
    if (pdfInput) {
      pdfInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
          loadPdfFile(file);
        }
        e.target.value = '';
      });
    }

    // Action Buttons
    if (undoBtn) undoBtn.addEventListener('click', undo);
    if (redoBtn) redoBtn.addEventListener('click', redo);

    const clearBtn = document.getElementById('wbClearBtn');
    if (clearBtn) clearBtn.addEventListener('click', clearBoard);

    const exportBtn = document.getElementById('wbExportPngBtn');
    if (exportBtn) exportBtn.addEventListener('click', exportPNG);

    const printBtn = document.getElementById('wbPrintBtn');
    if (printBtn) printBtn.addEventListener('click', printBoard);

    const zoomInBtn = document.getElementById('wbZoomIn');
    if (zoomInBtn) zoomInBtn.addEventListener('click', zoomIn);

    const zoomOutBtn = document.getElementById('wbZoomOut');
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', zoomOut);

    const zoomResetBtn = document.getElementById('wbZoomReset');
    if (zoomResetBtn) zoomResetBtn.addEventListener('click', resetZoom);

    // Presentation Mode Buttons
    if (presentBtn) presentBtn.addEventListener('click', () => togglePresentationMode(true));
    if (exitPresentBtn) exitPresentBtn.addEventListener('click', () => togglePresentationMode(false));

    // Presentation Mode Floating Tool Controls
    if (presToolsBtn) presToolsBtn.addEventListener('click', () => togglePresToolPanel());
    if (presHideToolsBtn) presHideToolsBtn.addEventListener('click', () => togglePresToolPanel(false));

    const presUndoBtn = document.getElementById('wbPresUndoBtn');
    if (presUndoBtn) presUndoBtn.addEventListener('click', undo);

    const presRedoBtn = document.getElementById('wbPresRedoBtn');
    if (presRedoBtn) presRedoBtn.addEventListener('click', redo);

    const presClearBtn = document.getElementById('wbPresClearBtn');
    if (presClearBtn) presClearBtn.addEventListener('click', clearBoard);

    // Collapsible Toolbar Button
    if (toggleToolbarBtn) toggleToolbarBtn.addEventListener('click', () => toggleToolbar());

    // Multi-page PDF Navigation Buttons
    if (firstPdfBtn) firstPdfBtn.addEventListener('click', firstPdfPage);
    if (prevPdfBtn) prevPdfBtn.addEventListener('click', prevPdfPage);
    if (nextPdfBtn) nextPdfBtn.addEventListener('click', nextPdfPage);
    if (lastPdfBtn) lastPdfBtn.addEventListener('click', lastPdfPage);

    // Dedicated Teaching Assets Trigger Buttons
    const assetTriggerBtns = [
      document.getElementById('wbHeaderAssetsBtn'),
      document.getElementById('wbToolbarAssetsBtn'),
      document.getElementById('wbPresHeaderAssetsBtn'),
      document.getElementById('wbPresAssetsBtn')
    ];
    assetTriggerBtns.forEach(btn => {
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleAssetsDrawer();
        });
      }
    });

    const closeAssetsBtn = document.getElementById('wbCloseAssetsDrawerBtn');
    if (closeAssetsBtn) {
      closeAssetsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleAssetsDrawer(false);
      });
    }

    // Presentation Header Direct Controls
    const presToolsHeaderBtn = document.getElementById('wbPresHeaderToolsBtn');
    if (presToolsHeaderBtn) {
      presToolsHeaderBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        togglePresToolPanel();
      });
    }

    const presExitHeaderBtn = document.getElementById('wbPresExitBtn');
    if (presExitHeaderBtn) {
      presExitHeaderBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        togglePresentationMode(false);
      });
    }

    const presPrevBtn = document.getElementById('wbPresPdfPrev');
    if (presPrevBtn) {
      presPrevBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        prevPdfPage();
      });
    }

    const presNextBtn = document.getElementById('wbPresPdfNext');
    if (presNextBtn) {
      presNextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        nextPdfPage();
      });
    }

    // Presentation Quick Actions Trigger & Actions
    const presQaBtn = document.getElementById('wbPresQuickActionsBtn');
    if (presQaBtn) {
      presQaBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        togglePresQuickActions();
      });
    }

    const presQaZoomIn = document.getElementById('wbPresQaZoomIn');
    if (presQaZoomIn) presQaZoomIn.addEventListener('click', () => { zoomIn(); togglePresQuickActions(false); });

    const presQaZoomOut = document.getElementById('wbPresQaZoomOut');
    if (presQaZoomOut) presQaZoomOut.addEventListener('click', () => { zoomOut(); togglePresQuickActions(false); });

    const presQaZoomReset = document.getElementById('wbPresQaZoomReset');
    if (presQaZoomReset) presQaZoomReset.addEventListener('click', () => { resetZoom(); togglePresQuickActions(false); });

    const presQaUndo = document.getElementById('wbPresQaUndo');
    if (presQaUndo) presQaUndo.addEventListener('click', () => { undo(); togglePresQuickActions(false); });

    const presQaRedo = document.getElementById('wbPresQaRedo');
    if (presQaRedo) presQaRedo.addEventListener('click', () => { redo(); togglePresQuickActions(false); });

    const presQaExport = document.getElementById('wbPresQaExport');
    if (presQaExport) presQaExport.addEventListener('click', () => { exportPNG(); togglePresQuickActions(false); });

    const presQaPrint = document.getElementById('wbPresQaPrint');
    if (presQaPrint) presQaPrint.addEventListener('click', () => { printBoard(); togglePresQuickActions(false); });

    const presQaClear = document.getElementById('wbPresQaClear');
    if (presQaClear) presQaClear.addEventListener('click', () => { clearBoard(); togglePresQuickActions(false); });

    // Presentation Worksheet PDF Upload Trigger
    const presPdfUpload = document.getElementById('wbPresPdfUploadBtn');
    if (presPdfUpload) {
      presPdfUpload.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const pdfInput = document.getElementById('wbPdfInput');
        if (pdfInput) {
          pdfInput.value = '';
          pdfInput.click();
        }
      });
    }

    // Presentation Diagram / Image Upload Trigger
    const presImgUpload = document.getElementById('wbPresImgUploadBtn');
    if (presImgUpload) {
      presImgUpload.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const imgInput = document.getElementById('wbImgInput');
        if (imgInput) {
          imgInput.value = '';
          imgInput.click();
        }
      });
    }

    // Presentation Background Trigger & Selection
    const presBgBtnEl = document.getElementById('wbPresBgBtn');
    if (presBgBtnEl) {
      presBgBtnEl.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        togglePresBgMenu();
      });
    }

    const presBgBtns = document.querySelectorAll('[data-pres-bg]');
    presBgBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const pattern = btn.getAttribute('data-pres-bg');
        if (pattern) {
          setGridBackground(pattern);
          togglePresBgMenu(false);
        }
      });
    });

    // Presentation Tool Panel Subject Trigger
    const presSubjectBtn = document.getElementById('wbPresSubjectBtn');
    if (presSubjectBtn) {
      presSubjectBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleSubjectDrawer();
      });
    }

    // Interactive Teacher Feedback & Feature Request System (Zero Backend)
    function updateFeedbackLinks() {
      const textEl = document.getElementById('wbFeedbackText');
      const nameEl = document.getElementById('wbFeedbackName');
      const emailEl = document.getElementById('wbFeedbackEmail');
      const waBtn = document.getElementById('wbFeedbackWaBtn');
      const mailBtn = document.getElementById('wbFeedbackMailBtn');

      const userText = textEl ? textEl.value.trim() : '';
      const userName = nameEl ? nameEl.value.trim() : '';
      const userEmail = emailEl ? emailEl.value.trim() : '';

      let waMsg = 'Hi Victory Fluent Forum! I have feedback / a feature suggestion for Teaching Studio:\n\n';
      if (userText) {
        waMsg += userText + '\n\n';
      } else {
        waMsg += '[My feature suggestion or classroom workflow]\n\n';
      }
      if (userName) waMsg += `From: ${userName}\n`;
      if (userEmail) waMsg += `Email: ${userEmail}\n`;

      let mailSubject = 'Teaching Studio Teacher Feedback';
      let mailBody = 'Hi VFF Team,\n\n';
      if (userText) {
        mailBody += `My feedback / feature suggestion is:\n${userText}\n\n`;
      } else {
        mailBody += 'My feedback / feature suggestion is:\n\n';
      }
      if (userName) mailBody += `Name: ${userName}\n`;
      if (userEmail) mailBody += `Email: ${userEmail}\n`;

      if (waBtn) {
        waBtn.href = `https://wa.me/919272045032?text=${encodeURIComponent(waMsg.trim())}`;
      }
      if (mailBtn) {
        mailBtn.href = `mailto:contact@victoryfluentforum.com?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`;
      }
    }

    const feedbackText = document.getElementById('wbFeedbackText');
    const feedbackName = document.getElementById('wbFeedbackName');
    const feedbackEmail = document.getElementById('wbFeedbackEmail');
    if (feedbackText) feedbackText.addEventListener('input', updateFeedbackLinks);
    if (feedbackName) feedbackName.addEventListener('input', updateFeedbackLinks);
    if (feedbackEmail) feedbackEmail.addEventListener('input', updateFeedbackLinks);

    const feedbackChips = document.querySelectorAll('.wb-feedback-chip');
    feedbackChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const topic = chip.getAttribute('data-topic') || chip.textContent.replace(/^\+\s*/, '').trim();
        const wasSelected = chip.classList.contains('selected');
        feedbackChips.forEach(c => c.classList.remove('selected'));

        if (!wasSelected) {
          chip.classList.add('selected');
          if (feedbackText) {
            if (!feedbackText.value.trim()) {
              feedbackText.value = `I would love to see: ${topic}. `;
            } else if (!feedbackText.value.includes(topic)) {
              feedbackText.value = feedbackText.value.trim() + `\nSuggestion: ${topic}`;
            }
          }
        }
        updateFeedbackLinks();
      });
    });

    updateFeedbackLinks();

    updateStrokePreview();
    updateSubjectToolsDrawer('general');
  }

  function updateStrokePreview() {
    const previewDot = document.getElementById('wbStrokePreviewDot');
    if (previewDot) {
      previewDot.style.width = Math.min(state.strokeWidth, 24) + 'px';
      previewDot.style.height = Math.min(state.strokeWidth, 24) + 'px';
      previewDot.style.backgroundColor = state.strokeColor;
    }
    if (state.currentTool === 'eraser') {
      updateEraserCursor();
    }
  }

  /* ============================================================
     HELPER FUNCTIONS
     ============================================================ */
  function trackEvent(eventName, payload) {
    if (window.ToolHub && window.ToolHub.Analytics && typeof window.ToolHub.Analytics.track === 'function') {
      window.ToolHub.Analytics.track(eventName, payload);
    }
  }

  function debounce(func, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  /* ============================================================
     CONSENT & PRIVACY UX ENGINE (PHASE 2.7)
     ============================================================ */
  function getConsentState() {
    return ConsentState.status;
  }

  function setConsentState(status) {
    return ConsentState.setConsent(status);
  }

  function revokeConsent() {
    return ConsentState.revokeConsent();
  }

  function isConsentCurrent() {
    return ConsentState.isConsentCurrent();
  }

  function showConsentModal() {
    const modal = document.getElementById('wbConsentModal');
    if (modal) {
      modal.style.display = 'flex';
      void modal.offsetWidth; // Force CSS reflow
      modal.classList.add('active');
      document.body.classList.add('wb-modal-open');
      const allowBtn = document.getElementById('wbConsentAllowBtn');
      if (allowBtn) allowBtn.focus();
    }
  }

  function hideConsentModal(recordChoice = null) {
    const modal = document.getElementById('wbConsentModal');
    if (modal) {
      modal.classList.remove('active');
      setTimeout(() => {
        modal.style.display = 'none';
        document.body.classList.remove('wb-modal-open');
      }, 220);
    }
    if (recordChoice) {
      setConsentState(recordChoice);
    }
  }

  function openPrivacySettings() {
    updatePrivacyUI();
    const modal = document.getElementById('wbPrivacyModal');
    if (modal) {
      modal.style.display = 'flex';
      void modal.offsetWidth; // Force CSS reflow
      modal.classList.add('active');
      document.body.classList.add('wb-modal-open');
    }
  }

  function closePrivacySettings() {
    const modal = document.getElementById('wbPrivacyModal');
    if (modal) {
      modal.classList.remove('active');
      setTimeout(() => {
        modal.style.display = 'none';
        document.body.classList.remove('wb-modal-open');
      }, 220);
    }
  }

  function updatePrivacyUI() {
    const status = ConsentState.status;
    const badge = document.getElementById('wbPrivacyStatusBadge');
    const statusText = document.getElementById('wbPrivacyStatusText');
    const descText = document.getElementById('wbPrivacyDescText');
    const toggleBtn = document.getElementById('wbPrivacyToggleBtn');
    const signalsStatus = document.getElementById('wbCatStatusSignals');
    const consentVer = document.getElementById('wbMetaConsentVer');
    const policyVer = document.getElementById('wbMetaPolicyVer');
    const timestampEl = document.getElementById('wbMetaTimestamp');
    const rawJsonEl = document.getElementById('wbPrivacyRawJson');

    if (consentVer) consentVer.textContent = CURRENT_CONSENT_VERSION;
    if (policyVer) policyVer.textContent = CURRENT_POLICY_VERSION;

    if (timestampEl) {
      const ts = ConsentState.updatedAt || ConsentState.consentedAt;
      timestampEl.textContent = ts ? new Date(ts).toLocaleString() : 'Not Recorded';
    }

    if (badge && statusText && toggleBtn) {
      badge.className = 'wb-privacy-status-badge';
      if (status === CONSENT_STATES.GRANTED) {
        badge.classList.add('status-granted');
        statusText.textContent = 'Helping Improve VFF';
        if (descText) {
          descText.textContent = 'Active: Anonymous structural signals (lesson stages, tool choices, and template scaffolding) are shared to improve Project Genome and the central VFF AI. Uploaded materials, PDFs, and student information are strictly excluded.';
        }
        toggleBtn.innerHTML = '<i class="fas fa-hand-paper"></i> Withdraw Participation';
        toggleBtn.className = 'wb-privacy-action-btn btn-danger';
        toggleBtn.onclick = () => {
          ConsentState.revokeConsent();
          updatePrivacyUI();
        };
        if (signalsStatus) {
          signalsStatus.textContent = 'Active';
          signalsStatus.className = 'wb-cat-status status-active';
        }
      } else if (status === CONSENT_STATES.DENIED) {
        badge.classList.add('status-denied');
        statusText.textContent = 'Not Participating';
        if (descText) {
          descText.textContent = 'Local Only: You chose "Not Now". All whiteboard features remain 100% free and functional. No teaching signals or lesson data are shared.';
        }
        toggleBtn.innerHTML = '<i class="fas fa-check-circle"></i> Allow &amp; Help Improve VFF';
        toggleBtn.className = 'wb-privacy-action-btn btn-primary';
        toggleBtn.onclick = () => {
          ConsentState.setConsent(CONSENT_STATES.GRANTED);
          updatePrivacyUI();
        };
        if (signalsStatus) {
          signalsStatus.textContent = 'Disabled';
          signalsStatus.className = 'wb-cat-status status-disabled';
        }
      } else if (status === CONSENT_STATES.REVOKED) {
        badge.classList.add('status-revoked');
        statusText.textContent = 'Withdrawn';
        if (descText) {
          descText.textContent = 'Withdrawn: Prior contribution permission was revoked. All session telemetry is blocked. No data will be shared for future Project Genome learning.';
        }
        toggleBtn.innerHTML = '<i class="fas fa-undo"></i> Re-enable &amp; Help Improve VFF';
        toggleBtn.className = 'wb-privacy-action-btn btn-primary';
        toggleBtn.onclick = () => {
          ConsentState.setConsent(CONSENT_STATES.GRANTED);
          updatePrivacyUI();
        };
        if (signalsStatus) {
          signalsStatus.textContent = 'Disabled';
          signalsStatus.className = 'wb-cat-status status-disabled';
        }
      } else {
        badge.classList.add('status-unknown');
        statusText.textContent = 'Not Chosen';
        if (descText) {
          descText.textContent = 'No decision recorded yet. You can choose whether to share anonymous teaching patterns or keep everything local.';
        }
        toggleBtn.innerHTML = '<i class="fas fa-shield-alt"></i> Choose Participation';
        toggleBtn.className = 'wb-privacy-action-btn btn-primary';
        toggleBtn.onclick = () => {
          closePrivacySettings();
          showConsentModal();
        };
        if (signalsStatus) {
          signalsStatus.textContent = 'Pending';
          signalsStatus.className = 'wb-cat-status status-disabled';
        }
      }
    }

    if (rawJsonEl) {
      const record = ConsentState.getLocalRecord() || ConsentState.getSummary();
      rawJsonEl.textContent = JSON.stringify(record, null, 2);
    }
  }

  function initConsentEngine() {
    // 1. Initialize State from localStorage
    ConsentState.init();

    // 2. Attach First-Visit Modal Listeners
    const allowBtn = document.getElementById('wbConsentAllowBtn');
    if (allowBtn) {
      allowBtn.addEventListener('click', () => {
        hideConsentModal(CONSENT_STATES.GRANTED);
      });
    }

    const notNowBtn = document.getElementById('wbConsentNotNowBtn');
    if (notNowBtn) {
      notNowBtn.addEventListener('click', () => {
        hideConsentModal(CONSENT_STATES.DENIED);
      });
    }

    const closeBtn = document.getElementById('wbConsentCloseBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        hideConsentModal(CONSENT_STATES.DENIED);
      });
    }

    const consentModal = document.getElementById('wbConsentModal');
    if (consentModal) {
      consentModal.addEventListener('click', (e) => {
        if (e.target === consentModal) {
          hideConsentModal(CONSENT_STATES.DENIED);
        }
      });
    }

    // 3. Attach Privacy Settings Listeners
    const privacyBtn = document.getElementById('wbPrivacyBtn');
    if (privacyBtn) {
      privacyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openPrivacySettings();
      });
    }

    const presPrivacyBtn = document.getElementById('wbPresQaPrivacy');
    if (presPrivacyBtn) {
      presPrivacyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        togglePresQuickActions(false);
        openPrivacySettings();
      });
    }

    const privacyCloseBtn = document.getElementById('wbPrivacyCloseBtn');
    if (privacyCloseBtn) {
      privacyCloseBtn.addEventListener('click', () => {
        closePrivacySettings();
      });
    }

    const privacyModal = document.getElementById('wbPrivacyModal');
    if (privacyModal) {
      privacyModal.addEventListener('click', (e) => {
        if (e.target === privacyModal) {
          closePrivacySettings();
        }
      });
    }

    const resetBtn = document.getElementById('wbPrivacyResetBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('Reset your local privacy choice? You will be prompted again on next meaningful use.')) {
          ConsentState.resetConsent();
          updatePrivacyUI();
          closePrivacySettings();
          setTimeout(showConsentModal, 300);
        }
      });
    }

    // Escape Key Listener to dismiss whichever modal is active
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.keyCode === 27) {
        if (consentModal && consentModal.classList.contains('active')) {
          hideConsentModal(CONSENT_STATES.DENIED);
        } else if (privacyModal && privacyModal.classList.contains('active')) {
          closePrivacySettings();
        }
      }
    });

    // 4. Evaluate First-Visit Display:
    // If state === unknown: Show the first-visit modal!
    if (ConsentState.status === CONSENT_STATES.UNKNOWN) {
      setTimeout(() => {
        showConsentModal();
      }, 400);
    }
  }

  // Export Engine to Global Scope
  window.VFFWhiteboard = {
    state,
    TeachingMaterial,
    TeachingSession,
    PedagogicalSignal,
    ConsentState,
    GenomeExportAdapter,
    TeachingArtifact,
    undo,
    redo,
    clearBoard,
    exportPNG,
    printBoard,
    selectTool,
    setSubjectMode,
    toggleSubjectDropdown,
    setGridBackground,
    toggleSubjectDrawer,
    togglePresentationMode,
    toggleToolbar,
    togglePresToolPanel,
    togglePresQuickActions,
    togglePresBgMenu,
    hideEmptyState,
    showEmptyState,
    toggleEmptyState,
    commitDirectText,
    cancelDirectText,
    nextPdfPage,
    prevPdfPage,
    firstPdfPage,
    lastPdfPage,
    // Phase 2 Interactive Teaching Engine Exports
    setLessonStage,
    nextLessonStage,
    prevLessonStage,
    toggleAssetsDrawer,
    switchAssetTab,
    filterAnnotationCategory,
    stampSticker,
    addLessonBlock,
    deleteBlock,
    duplicateBlock,
    toggleAnswerReveal,
    insertInfographic,
    loadTeachingTemplate,
    toggleQuickActions,
    toggleSpotlight,
    updateSpotlight,
    toggleLaser,
    updateLaser,
    renderBlocksDOM,
    // Phase 2.5 Classroom Surfaces, PDF Underlay & Ergonomics Exports
    setCanvasSurface,
    togglePdfChalkboardMode,
    toggleStylusOnly,
    toggleLineStyle,
    setStrokeColor,
    // Phase 2.7 Consent UX & Local State Engine Exports
    getConsentState,
    setConsentState,
    revokeConsent,
    isConsentCurrent,
    showConsentModal,
    hideConsentModal,
    openPrivacySettings,
    closePrivacySettings,
    // Phase 3 Studio Recording & Safe Eraser Engine Exports
    startRecording,
    stopRecording,
    toggleRecording,
    showRecordingModal,
    closeRecordingModal,
    deleteRecording,
    redrawImageCanvas,
    markRecordingDirty,
    // Phase 2.8 Teaching Object Selection & Mathematics Toolkit Exports
    selectTool,
    selectObject,
    deselectObject,
    duplicateSelectedObject,
    deleteSelectedObject,
    toggleLockSelectedObject,
    bringForwardSelectedObject,
    sendBackSelectedObject,
    toggleShapesPopover,
    toggleMathPopover,
    redrawPdfCanvas
  };

})();

