import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { DOCUMENT_TYPES, PROFILE_TYPES } from '@/api/priorityProfile.api';
import { AppButton } from '@/components/AppButton';
import { Screen } from '@/components/Screen';
import { config } from '@/constants/config';
import { colors } from '@/constants/colors';
import usePriorityProfileStore from '@/store/priorityProfile.store';
import type { PriorityProfileDocument, PriorityProfileResponse, PriorityStatus } from '@/types/priorityProfile';
import { getErrorMessage } from '@/utils/validation';

const statusLabels: Record<string, string> = {
  NONE: 'No Application',
  PENDING: 'Pending Verification',
  UNDER_REVIEW: 'Under Review',
  DOCUMENT_VERIFIED: 'Document Verified',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  EXPIRED: 'Expired',
};

const priorityPassengerRoute = '/priority-passenger' as Href;

const timeline = [
  { key: 'PENDING', label: 'Pending Verification', text: 'Your application was received successfully.', icon: 'clock-outline' },
  { key: 'UNDER_REVIEW', label: 'Under Review', text: 'A transit officer is auditing your documents.', icon: 'account-search-outline' },
  { key: 'DOCUMENT_VERIFIED', label: 'Document Verified', text: 'Documents are ready for final decision.', icon: 'file-check-outline' },
  { key: 'APPROVED', label: 'Approved', text: 'Priority benefits are active after approval.', icon: 'check-decagram-outline' },
] as const;

const formatDate = (value?: string | null) => {
  if (!value) return 'Not submitted';
  return new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: '2-digit' }).format(new Date(value));
};

const getProfileTypeLabel = (value?: string | null) => (
  PROFILE_TYPES.find((type) => type.value === value)?.label || value || 'Not selected'
);

const getDocumentTypeLabel = (value?: string | null) => (
  DOCUMENT_TYPES.find((type) => type.value === value)?.label || value || 'Unknown document'
);

const formatSize = (size?: number) => {
  if (!size) return 'Unknown size';
  if (size < 1024 * 1024) return `${Math.max(Math.round(size / 1024), 1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const resolveDocumentUrl = (url?: string) => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  const apiRoot = config.apiBaseUrl.replace(/\/api\/?$/, '');
  return `${apiRoot}${url.startsWith('/') ? url : `/${url}`}`;
};

const isImageDocument = (document: PriorityProfileDocument) => (
  Boolean(document.mimeType?.startsWith('image/')) || /\.(jpg|jpeg|png|webp)$/i.test(document.url || document.fileName || '')
);

const normalizeStatus = (profile?: PriorityProfileResponse | null): PriorityStatus => {
  const status = profile?.profile?.status || profile?.priorityStatus || 'NONE';
  if (status === 'PENDING' && (profile?.profile?.documents?.length || 0) > 0) {
    return 'UNDER_REVIEW';
  }
  return status;
};

const getStepState = (currentStatus: PriorityStatus, stepKey: string) => {
  if (currentStatus === 'APPROVED') return 'done';
  if (currentStatus === 'REJECTED') return stepKey === 'PENDING' || stepKey === 'UNDER_REVIEW' ? 'done' : 'idle';

  const order = ['PENDING', 'UNDER_REVIEW', 'DOCUMENT_VERIFIED', 'APPROVED'];
  const currentIndex = order.indexOf(currentStatus);
  const stepIndex = order.indexOf(stepKey);
  if (stepIndex < currentIndex) return 'done';
  if (stepIndex === currentIndex) return 'active';
  return 'idle';
};

const getRequestStatus = (request: PriorityProfileResponse): PriorityStatus => (
  request.profile?.status || request.priorityStatus || 'NONE'
);

export default function PriorityApprovalStatusScreen() {
  const status = usePriorityProfileStore((state) => state.status);
  const requests = usePriorityProfileStore((state) => state.requests);
  const isLoading = usePriorityProfileStore((state) => state.isLoading);
  const loadStatus = usePriorityProfileStore((state) => state.loadStatus);
  const current = status || requests[0] || null;
  const currentStatus = normalizeStatus(current);
  const uploadedDocuments = current?.profile?.documents || [];
  const [previewFile, setPreviewFile] = useState<{ name: string; uri: string } | null>(null);

  const openUploadedDocument = async (document: PriorityProfileDocument) => {
    const url = resolveDocumentUrl(document.url);
    if (!url) {
      Alert.alert('Document unavailable', 'This uploaded document does not have a file URL.');
      return;
    }

    if (isImageDocument(document)) {
      setPreviewFile({
        name: document.originalName || document.fileName || 'Uploaded document',
        uri: url,
      });
      return;
    }

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        Alert.alert('Document unavailable', 'This document cannot be opened on this device.');
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert('Document unavailable', 'This document cannot be opened on this device.');
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadStatus().catch((error) => {
        Alert.alert('Unable to load status', getErrorMessage(error, 'Unable to load priority application status.'));
      });
    }, [loadStatus]),
  );

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" hitSlop={10} onPress={() => router.back()}>
          <MaterialCommunityIcons color={colors.primary} name="arrow-left" size={25} />
        </Pressable>
        <Text style={styles.headerTitle}>Application Status</Text>
      </View>

      {isLoading && !current ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Loading application status...</Text>
        </View>
      ) : (
        <>
          <View style={styles.summaryCard}>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>{statusLabels[currentStatus] || currentStatus}</Text>
            </View>
            <View style={styles.summaryBlock}>
              <Text style={styles.label}>APPLICATION ID</Text>
              <Text style={styles.value}>{current?.requestId ? `#${current.requestId.slice(-6).toUpperCase()}` : 'Not available'}</Text>
            </View>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Text style={styles.label}>PASSENGER NAME</Text>
                <Text style={styles.smallValue}>{current?.profile?.fullName || 'Not submitted'}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.label}>PRIORITY TYPE</Text>
                <Text style={styles.smallValue}>{getProfileTypeLabel(current?.profile?.profileType)}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.label}>SUBMITTED DATE</Text>
                <Text style={styles.smallValue}>{formatDate(current?.profile?.submittedAt)}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.label}>CURRENT STATUS</Text>
                <Text style={styles.smallValue}>{statusLabels[currentStatus] || currentStatus}</Text>
              </View>
            </View>
          </View>

          <View style={styles.timelineCard}>
            <Text style={styles.sectionTitle}>Verification Timeline</Text>
            {timeline.map((step) => {
              const state = getStepState(currentStatus, step.key);
              return (
                <View key={step.key} style={styles.timelineRow}>
                  <View style={[styles.timelineIcon, state === 'done' && styles.timelineDone, state === 'active' && styles.timelineActive]}>
                    <MaterialCommunityIcons
                      color={state === 'idle' ? colors.muted : colors.white}
                      name={state === 'done' ? 'check' : step.icon}
                      size={20}
                    />
                  </View>
                  <View style={[styles.timelineText, state === 'idle' && styles.timelineTextIdle]}>
                    <Text style={styles.timelineTitle}>{step.label}</Text>
                    <Text style={styles.timelineDescription}>{step.text}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={styles.documentsCard}>
            <Text style={styles.sectionTitle}>Uploaded Documents</Text>
            {uploadedDocuments.length === 0 ? (
              <View style={styles.emptyDocuments}>
                <MaterialCommunityIcons color={colors.muted} name="file-document-outline" size={24} />
                <Text style={styles.emptyDocumentsText}>No verification documents have been uploaded yet.</Text>
              </View>
            ) : (
              <View style={styles.documentList}>
                {uploadedDocuments.map((document) => (
                  <View key={document._id || document.fileName || document.originalName} style={styles.documentItem}>
                    <MaterialCommunityIcons color={colors.accent} name="file-check-outline" size={23} />
                    <View style={styles.documentTextBlock}>
                      <Text numberOfLines={1} style={styles.documentName}>
                        {document.originalName || document.fileName || 'Uploaded document'}
                      </Text>
                      <Text style={styles.documentMeta}>
                        {getDocumentTypeLabel(document.type)} • {formatSize(document.size)}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() => openUploadedDocument(document)}
                      style={({ pressed }) => [styles.viewDocumentButton, pressed && styles.pressed]}
                    >
                      <MaterialCommunityIcons color={colors.white} name="eye-outline" size={18} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </View>

          {currentStatus === 'REJECTED' ? (
            <View style={styles.rejectionCard}>
              <MaterialCommunityIcons color={colors.error} name="alert-circle-outline" size={24} />
              <View style={styles.rejectionTextBlock}>
                <Text style={styles.rejectionTitle}>Application Issues Found</Text>
                <Text style={styles.rejectionText}>{current?.profile?.rejectionReason || 'Please review and submit documents again.'}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.historyCard}>
            <Text style={styles.sectionTitle}>All Submitted Applications</Text>
            {requests.length === 0 ? (
              <View style={styles.emptyDocuments}>
                <MaterialCommunityIcons color={colors.muted} name="clipboard-text-outline" size={24} />
                <Text style={styles.emptyDocumentsText}>No submitted applications yet.</Text>
              </View>
            ) : (
              <View style={styles.historyList}>
                {requests.map((request) => {
                  const requestStatus = getRequestStatus(request);
                  const requestDocuments = request.profile?.documents || [];

                  return (
                    <View key={request.requestId || `${request.profile?.submittedAt}-${request.profile?.identityNumber}`} style={styles.historyItem}>
                      <View style={styles.historyHeader}>
                        <View style={styles.historyTitleBlock}>
                          <Text numberOfLines={1} style={styles.historyName}>
                            {request.profile?.fullName || 'Unnamed applicant'}
                          </Text>
                          <Text style={styles.historyMeta}>
                            {getProfileTypeLabel(request.profile?.profileType)} • {formatDate(request.profile?.submittedAt)}
                          </Text>
                        </View>
                        <View style={[
                          styles.historyBadge,
                          requestStatus === 'APPROVED' && styles.historyBadgeApproved,
                          requestStatus === 'REJECTED' && styles.historyBadgeRejected,
                        ]}
                        >
                          <Text style={[
                            styles.historyBadgeText,
                            requestStatus === 'APPROVED' && styles.historyBadgeTextApproved,
                            requestStatus === 'REJECTED' && styles.historyBadgeTextRejected,
                          ]}
                          >
                            {statusLabels[requestStatus] || requestStatus}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.historyInfoGrid}>
                        <View style={styles.historyInfoItem}>
                          <Text style={styles.label}>APPLICATION ID</Text>
                          <Text style={styles.historyValue}>{request.requestId ? `#${request.requestId.slice(-6).toUpperCase()}` : 'N/A'}</Text>
                        </View>
                        <View style={styles.historyInfoItem}>
                          <Text style={styles.label}>REVIEWED DATE</Text>
                          <Text style={styles.historyValue}>{formatDate(request.profile?.reviewedAt)}</Text>
                        </View>
                      </View>

                      {request.profile?.rejectionReason ? (
                        <View style={styles.historyReason}>
                          <Text style={styles.historyReasonTitle}>Rejection reason</Text>
                          <Text style={styles.historyReasonText}>{request.profile.rejectionReason}</Text>
                        </View>
                      ) : null}

                      {requestDocuments.length > 0 ? (
                        <View style={styles.historyDocuments}>
                          <Text style={styles.historyDocumentsTitle}>Submitted documents</Text>
                          {requestDocuments.map((document) => (
                            <View key={document._id || document.fileName || document.originalName} style={styles.historyDocumentItem}>
                              <MaterialCommunityIcons color={colors.accent} name="file-document-outline" size={20} />
                              <View style={styles.documentTextBlock}>
                                <Text numberOfLines={1} style={styles.historyDocumentName}>
                                  {document.originalName || document.fileName || 'Uploaded document'}
                                </Text>
                                <Text style={styles.documentMeta}>
                                  {getDocumentTypeLabel(document.type)} • {formatSize(document.size)}
                                </Text>
                              </View>
                              <Pressable
                                accessibilityRole="button"
                                hitSlop={8}
                                onPress={() => openUploadedDocument(document)}
                                style={({ pressed }) => [styles.historyViewButton, pressed && styles.pressed]}
                              >
                                <MaterialCommunityIcons color={colors.primary} name="eye-outline" size={19} />
                              </Pressable>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text style={styles.noHistoryDocuments}>No documents attached.</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </>
      )}

      <View style={styles.actions}>
        <AppButton title="Back to Home" onPress={() => router.replace(priorityPassengerRoute)} />
      </View>

      <Modal
        animationType="fade"
        onRequestClose={() => setPreviewFile(null)}
        transparent
        visible={Boolean(previewFile)}
      >
        <View style={styles.previewOverlay}>
          <View style={styles.previewModal}>
            <View style={styles.previewHeader}>
              <Text numberOfLines={1} style={styles.previewTitle}>{previewFile?.name}</Text>
              <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setPreviewFile(null)}>
                <MaterialCommunityIcons color={colors.primary} name="close" size={24} />
              </Pressable>
            </View>
            {previewFile?.uri ? (
              <Image resizeMode="contain" source={{ uri: previewFile.uri }} style={styles.previewImage} />
            ) : null}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  headerTitle: { color: colors.primary, fontSize: 22, fontWeight: '900' },
  loading: { minHeight: 240, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  summaryCard: { gap: 18, padding: 18, borderRadius: 22, backgroundColor: colors.card },
  statusBadge: { alignSelf: 'flex-start', borderRadius: 16, backgroundColor: '#fff4d5', paddingHorizontal: 10, paddingVertical: 6 },
  statusBadgeText: { color: '#9a6500', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  summaryBlock: { gap: 4 },
  label: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  value: { color: colors.primary, fontSize: 22, fontWeight: '900' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  summaryItem: { width: '47%', gap: 4 },
  smallValue: { color: colors.text, fontSize: 14, fontWeight: '800' },
  timelineCard: { gap: 18, marginTop: 16, padding: 18, borderRadius: 22, backgroundColor: colors.card },
  sectionTitle: { color: colors.primary, fontSize: 18, fontWeight: '900' },
  timelineRow: { flexDirection: 'row', gap: 14 },
  timelineIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.surfaceHigh },
  timelineDone: { borderColor: '#2e7d32', backgroundColor: '#2e7d32' },
  timelineActive: { borderColor: '#ffb300', backgroundColor: '#ffb300' },
  timelineText: { flex: 1, paddingTop: 2, paddingBottom: 18 },
  timelineTextIdle: { opacity: 0.55 },
  timelineTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  timelineDescription: { marginTop: 3, color: colors.muted, fontSize: 12, lineHeight: 18 },
  rejectionCard: { flexDirection: 'row', gap: 12, marginTop: 16, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: '#f5c2c7', backgroundColor: colors.errorContainer },
  rejectionTextBlock: { flex: 1 },
  rejectionTitle: { color: colors.primary, fontSize: 14, fontWeight: '900' },
  rejectionText: { marginTop: 4, color: colors.muted, fontSize: 13, lineHeight: 19 },
  documentsCard: { gap: 16, marginTop: 16, padding: 18, borderRadius: 22, backgroundColor: colors.card },
  emptyDocuments: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, backgroundColor: colors.surfaceLow, padding: 14 },
  emptyDocumentsText: { flex: 1, color: colors.muted, fontSize: 13, fontWeight: '700', lineHeight: 19 },
  documentList: { gap: 10 },
  documentItem: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, borderWidth: 1, borderColor: '#d5e4dd', backgroundColor: colors.surfaceLow, padding: 12 },
  documentTextBlock: { flex: 1 },
  documentName: { color: colors.text, fontSize: 14, fontWeight: '900' },
  documentMeta: { marginTop: 3, color: colors.muted, fontSize: 11, fontWeight: '700' },
  viewDocumentButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: colors.primary },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  previewOverlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)', padding: 16 },
  previewModal: { height: '78%', overflow: 'hidden', borderRadius: 22, backgroundColor: colors.card },
  previewHeader: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.outline },
  previewTitle: { flex: 1, color: colors.primary, fontSize: 15, fontWeight: '900' },
  previewImage: { flex: 1, width: '100%', backgroundColor: colors.surfaceLow },
  historyCard: { gap: 16, marginTop: 16, padding: 18, borderRadius: 22, backgroundColor: colors.card },
  historyList: { gap: 14 },
  historyItem: { gap: 14, borderRadius: 18, borderWidth: 1, borderColor: '#d5e4dd', backgroundColor: colors.surfaceLow, padding: 14 },
  historyHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  historyTitleBlock: { flex: 1 },
  historyName: { color: colors.primary, fontSize: 15, fontWeight: '900' },
  historyMeta: { marginTop: 4, color: colors.muted, fontSize: 12, fontWeight: '700' },
  historyBadge: { borderRadius: 14, backgroundColor: '#fff4d5', paddingHorizontal: 9, paddingVertical: 6 },
  historyBadgeApproved: { backgroundColor: '#dff5e8' },
  historyBadgeRejected: { backgroundColor: colors.errorContainer },
  historyBadgeText: { color: '#9a6500', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  historyBadgeTextApproved: { color: '#1d6b3f' },
  historyBadgeTextRejected: { color: colors.error },
  historyInfoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  historyInfoItem: { width: '47%', gap: 4 },
  historyValue: { color: colors.text, fontSize: 12, fontWeight: '800' },
  historyReason: { borderRadius: 14, backgroundColor: colors.card, padding: 12 },
  historyReasonTitle: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  historyReasonText: { marginTop: 4, color: colors.muted, fontSize: 12, lineHeight: 18 },
  historyDocuments: { gap: 8 },
  historyDocumentsTitle: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  historyDocumentItem: { flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 14, backgroundColor: colors.card, padding: 10 },
  historyDocumentName: { color: colors.text, fontSize: 13, fontWeight: '900' },
  historyViewButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.card },
  noHistoryDocuments: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  actions: { marginTop: 20, paddingBottom: 20 },
});
