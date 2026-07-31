import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Alert, Image, Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { DOCUMENT_TYPES } from '@/api/priorityProfile.api';
import { AppButton } from '@/components/AppButton';
import { Screen } from '@/components/Screen';
import { colors } from '@/constants/colors';
import usePriorityProfileStore from '@/store/priorityProfile.store';
import type { PriorityDocumentAsset, PriorityDocumentType } from '@/types/priorityProfile';
import { getErrorMessage, validatePriorityRegistration } from '@/utils/validation';

type WebInputRef = {
  click: () => void;
  value: string;
} | null;

type DocumentGroup = {
  id: string;
  documentType: PriorityDocumentType;
};

const acceptedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const createGroup = (documentType: PriorityDocumentType = 'IDENTITY_FRONT'): DocumentGroup => ({
  id: `${documentType}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  documentType,
});

const getDocumentsForGroup = (documents: PriorityDocumentAsset[], groupId: string) => (
  documents.filter((document) => document.groupId === groupId)
);

const formatSize = (size?: number) => {
  if (!size) return 'Unknown size';
  if (size < 1024 * 1024) return `${Math.max(Math.round(size / 1024), 1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const isImageDocument = (mimeType?: string, uri?: string) => (
  Boolean(mimeType?.startsWith('image/')) || /\.(jpg|jpeg|png|webp)$/i.test(uri || '')
);

const getUploadStateText = (document: PriorityDocumentAsset) => {
  if (document.status === 'selected') return 'Ready to upload';
  if (document.status === 'uploading') return `Uploading ${Math.max(document.progress, 1)}%`;
  if (document.status === 'uploaded') return 'Uploaded';
  if (document.status === 'error') return 'Upload failed';
  return 'Waiting';
};

const getProgressWidth = (document: PriorityDocumentAsset) => {
  if (document.status === 'selected') return 12;
  if (document.status === 'uploaded') return 100;
  return Math.max(document.progress, document.status === 'uploading' ? 8 : 0);
};

export default function UploadVerificationDocumentsScreen() {
  const inputRefs = useRef<Record<string, WebInputRef>>({});
  const [documentGroups, setDocumentGroups] = useState<DocumentGroup[]>([createGroup()]);
  const [previewFile, setPreviewFile] = useState<{ name: string; uri: string; mimeType?: string } | null>(null);
  const draft = usePriorityProfileStore((state) => state.draft);
  const documents = usePriorityProfileStore((state) => state.documents);
  const replaceGroupDocuments = usePriorityProfileStore((state) => state.replaceGroupDocuments);
  const updateDocumentGroupType = usePriorityProfileStore((state) => state.updateDocumentGroupType);
  const removeDocumentGroup = usePriorityProfileStore((state) => state.removeDocumentGroup);
  const removeDocument = usePriorityProfileStore((state) => state.removeDocument);
  const submitApplication = usePriorityProfileStore((state) => state.submitApplication);
  const isSubmitting = usePriorityProfileStore((state) => state.isSubmitting);

  const replaceFiles = (
    group: DocumentGroup,
    files: Array<{ name: string; uri?: string; mimeType?: string; size?: number; file?: File }>,
  ) => {
    replaceGroupDocuments(group.id, group.documentType, files);
  };

  const handleNativePicker = async (group: DocumentGroup) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: acceptedMimeTypes,
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      replaceFiles(
        group,
        result.assets.slice(0, 5).map((asset) => ({
          name: asset.name,
          uri: asset.uri,
          mimeType: asset.mimeType,
          size: asset.size,
        })),
      );
    } catch (error) {
      Alert.alert('Cannot open file picker', getErrorMessage(error, 'Please try choosing the file again.'));
    }
  };

  const handleImageLibraryPicker = async (group: DocumentGroup) => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Photo permission needed', 'Please allow photo library access to choose CCCD or priority document images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 5,
        quality: 0.9,
      });

      if (result.canceled) return;

      replaceFiles(
        group,
        result.assets.slice(0, 5).map((asset, index) => ({
          name: asset.fileName || `priority-document-${index + 1}.jpg`,
          uri: asset.uri,
          mimeType: asset.mimeType || 'image/jpeg',
          size: asset.fileSize,
          file: asset.file,
        })),
      );
    } catch (error) {
      Alert.alert('Cannot open photo library', getErrorMessage(error, 'Please try choosing the image again.'));
    }
  };

  const handlePick = (group: DocumentGroup) => {
    if (Platform.OS === 'web') {
      inputRefs.current[group.id]?.click();
      return;
    }

    void handleNativePicker(group);
  };

  const handleWebFile = (group: DocumentGroup, event: { target?: { files?: FileList | null; value?: string } }) => {
    const selectedFiles = Array.from(event.target?.files || []).slice(0, 5);
    if (selectedFiles.length === 0) return;

    replaceFiles(
      group,
      selectedFiles.map((file) => ({
        name: file.name,
        mimeType: file.type,
        size: file.size,
        file,
        uri: URL.createObjectURL(file),
      })),
    );

    if (event.target) {
      event.target.value = '';
    }
  };

  const handleDocumentTypeChange = (groupId: string, documentType: PriorityDocumentType) => {
    setDocumentGroups((current) => current.map((group) => (
      group.id === groupId ? { ...group, documentType } : group
    )));
    updateDocumentGroupType(groupId, documentType);
  };

  const handleAddGroup = () => {
    setDocumentGroups((current) => [...current, createGroup('OTHER')]);
  };

  const handleRemoveGroup = (groupId: string) => {
    if (documentGroups.length === 1) return;
    setDocumentGroups((current) => current.filter((group) => group.id !== groupId));
    removeDocumentGroup(groupId);
  };

  const openSelectedFile = async (document: PriorityDocumentAsset) => {
    if (!document.uri) {
      Alert.alert('Preview unavailable', 'This file does not have a local preview URL.');
      return;
    }

    if (isImageDocument(document.mimeType, document.uri)) {
      setPreviewFile({ name: document.name, uri: document.uri, mimeType: document.mimeType });
      return;
    }

    try {
      const canOpen = await Linking.canOpenURL(document.uri);
      if (!canOpen) {
        Alert.alert('Preview unavailable', 'This file cannot be opened on this device.');
        return;
      }
      await Linking.openURL(document.uri);
    } catch {
      Alert.alert('Preview unavailable', 'This file cannot be opened on this device.');
    }
  };

  const validateDocuments = () => {
    const formErrors = validatePriorityRegistration(draft);
    if (Object.keys(formErrors).length > 0) {
      Alert.alert('Registration details needed', 'Please complete the registration form before submitting documents.');
      router.replace('/priority-passenger/register');
      return false;
    }

    if (documents.length === 0) {
      Alert.alert('Documents required', 'Please add at least one CCCD/CMND or priority verification document.');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateDocuments()) return;

    try {
      await submitApplication();
      Alert.alert('Application submitted', 'Your priority application has been submitted for verification.');
      router.replace('/priority-passenger/status');
    } catch (error) {
      Alert.alert('Submission failed', getErrorMessage(error, 'Unable to submit priority application.'));
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" hitSlop={10} onPress={() => router.back()}>
          <MaterialCommunityIcons color={colors.primary} name="arrow-left" size={25} />
        </Pressable>
        <View>
          <Text style={styles.kicker}>STEP 2 OF 2</Text>
          <Text style={styles.headerTitle}>Upload Verification Documents</Text>
        </View>
      </View>

      <Text style={styles.description}>
        Add groups such as CCCD/CMND front, CCCD/CMND back, and priority identification
        documents. Each group accepts JPG, PNG, WEBP or PDF, maximum 5 files.
      </Text>

      <View style={styles.list}>
        {documentGroups.map((group, index) => {
          const groupDocuments = getDocumentsForGroup(documents, group.id);

          return (
            <View key={group.id} style={styles.documentCard}>
              <View style={styles.documentHeader}>
                <View>
                  <Text style={styles.documentTitle}>Document group {index + 1}</Text>
                  <Text style={styles.documentSubtitle}>Choose the correct document type before uploading files.</Text>
                </View>
                {documentGroups.length > 1 ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => handleRemoveGroup(group.id)}
                    style={({ pressed }) => [styles.groupRemoveButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.groupRemoveText}>Remove</Text>
                  </Pressable>
                ) : null}
              </View>

              <View style={styles.selectorBlock}>
                <Text style={styles.label}>Document type</Text>
                <View style={styles.optionList}>
                  {DOCUMENT_TYPES.map((type) => (
                    <Pressable
                      key={type.value}
                      onPress={() => handleDocumentTypeChange(group.id, type.value)}
                      style={[styles.option, group.documentType === type.value && styles.optionActive]}
                    >
                      <Text style={[styles.optionText, group.documentType === type.value && styles.optionTextActive]}>
                        {type.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.pickerActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => handlePick(group)}
                  style={({ pressed }) => [styles.uploadBox, pressed && styles.pressed]}
                >
                  <MaterialCommunityIcons color={colors.primary} name="upload-outline" size={24} />
                  <View style={styles.uploadCopy}>
                    <Text style={styles.uploadTitle}>Choose Files</Text>
                    <Text style={styles.uploadSubtitle}>PDF or image files</Text>
                  </View>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => handleImageLibraryPicker(group)}
                  style={({ pressed }) => [styles.uploadBox, pressed && styles.pressed]}
                >
                  <MaterialCommunityIcons color={colors.primary} name="image-multiple-outline" size={24} />
                  <View style={styles.uploadCopy}>
                    <Text style={styles.uploadTitle}>Photo Library</Text>
                    <Text style={styles.uploadSubtitle}>
                      {groupDocuments.length > 0
                        ? `${groupDocuments.length} selected`
                        : 'Choose CCCD photos'}
                    </Text>
                  </View>
                </Pressable>
              </View>

              {groupDocuments.length > 0 ? (
                <View style={styles.fileList}>
                  <Text style={styles.fileListTitle}>Selected files</Text>
                  {groupDocuments.map((document) => (
                    <View key={document.id} style={styles.filePreview}>
                      <MaterialCommunityIcons color={colors.accent} name="file-check-outline" size={22} />
                      <View style={styles.fileTextBlock}>
                        <Text numberOfLines={1} style={styles.fileName}>{document.name}</Text>
                        <Text style={styles.fileMeta}>
                          {formatSize(document.size)} • {getUploadStateText(document)}
                        </Text>
                        <View style={styles.progressTrack}>
                          <View style={[styles.progressFill, { width: `${getProgressWidth(document)}%` }]} />
                        </View>
                      </View>
                      <View style={styles.fileActions}>
                        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => openSelectedFile(document)}>
                          <MaterialCommunityIcons color={colors.primary} name="eye-outline" size={21} />
                        </Pressable>
                        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => removeDocument(document.documentType, document.id)}>
                          <MaterialCommunityIcons color={colors.error} name="trash-can-outline" size={21} />
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}

              {Platform.OS === 'web' ? React.createElement('input' as never, {
                ref: (ref: WebInputRef) => {
                  inputRefs.current[group.id] = ref;
                },
                type: 'file',
                multiple: true,
                accept: 'image/jpeg,image/png,image/webp,application/pdf',
                style: { display: 'none' },
                onChange: (event: { target?: { files?: FileList | null; value?: string } }) => handleWebFile(group, event),
              }) : null}
            </View>
          );
        })}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={handleAddGroup}
        style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
      >
        <MaterialCommunityIcons color={colors.primary} name="plus" size={22} />
        <Text style={styles.addButtonText}>Add another type of document</Text>
      </Pressable>

      <View style={styles.actions}>
        <AppButton title="Back" variant="secondary" onPress={() => router.back()} />
        <AppButton title="Submit Application" loading={isSubmitting} onPress={handleSubmit} />
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
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  kicker: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  headerTitle: { color: colors.primary, fontSize: 22, fontWeight: '900' },
  description: { marginBottom: 18, color: colors.muted, fontSize: 15, lineHeight: 22 },
  list: { gap: 14 },
  documentCard: { gap: 16, padding: 18, borderRadius: 22, borderWidth: 1, borderColor: '#d5e4dd', backgroundColor: colors.surfaceLow },
  documentHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  documentTitle: { color: colors.primary, fontSize: 16, fontWeight: '900' },
  documentSubtitle: { marginTop: 4, color: colors.muted, fontSize: 12, lineHeight: 17 },
  groupRemoveButton: { borderRadius: 14, borderWidth: 1, borderColor: colors.outline, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.card },
  groupRemoveText: { color: colors.error, fontSize: 12, fontWeight: '900' },
  selectorBlock: { gap: 8 },
  label: { color: colors.text, fontSize: 14, fontWeight: '900' },
  optionList: { gap: 8 },
  option: { minHeight: 44, justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.card, paddingHorizontal: 14 },
  optionActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  optionText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  optionTextActive: { color: colors.white },
  uploadBox: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.outline, backgroundColor: colors.card, padding: 14 },
  pickerActions: { gap: 10 },
  uploadCopy: { flex: 1 },
  uploadTitle: { color: colors.primary, fontSize: 15, fontWeight: '900' },
  uploadSubtitle: { marginTop: 3, color: colors.muted, fontSize: 13, fontWeight: '700' },
  fileList: { gap: 10, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.75)', padding: 12 },
  fileListTitle: { color: colors.primary, fontSize: 14, fontWeight: '900' },
  filePreview: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, backgroundColor: colors.card },
  fileTextBlock: { flex: 1, gap: 4 },
  fileName: { color: colors.text, fontSize: 14, fontWeight: '900' },
  fileMeta: { color: colors.muted, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  fileActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressTrack: { height: 5, overflow: 'hidden', borderRadius: 5, backgroundColor: colors.surfaceHigh },
  progressFill: { height: '100%', borderRadius: 5, backgroundColor: colors.accent },
  addButton: { minHeight: 50, marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 25, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.card },
  addButtonText: { color: colors.primary, fontSize: 14, fontWeight: '900' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  previewOverlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)', padding: 16 },
  previewModal: { height: '78%', overflow: 'hidden', borderRadius: 22, backgroundColor: colors.card },
  previewHeader: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.outline },
  previewTitle: { flex: 1, color: colors.primary, fontSize: 15, fontWeight: '900' },
  previewImage: { flex: 1, width: '100%', backgroundColor: colors.surfaceLow },
  actions: { gap: 12, marginTop: 20, paddingBottom: 20 },
});
