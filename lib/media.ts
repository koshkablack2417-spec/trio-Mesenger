import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { MEDIA_BUCKET } from './chats';
import { supabase } from './supabase';

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // лимит бесплатного тарифа Supabase
export const MAX_CIRCLE_SECONDS = 60;

export type MediaKind = 'image' | 'video' | 'video_circle';

export type PickedMedia = {
  uri: string;
  mimeType: string;
  kind: MediaKind;
  durationMs: number | null;
  width: number | null;
  height: number | null;
};

function toPicked(asset: ImagePicker.ImagePickerAsset, kind: MediaKind): PickedMedia {
  return {
    uri: asset.uri,
    mimeType: asset.mimeType ?? (kind === 'image' ? 'image/jpeg' : 'video/mp4'),
    kind,
    durationMs: asset.duration ?? null,
    width: asset.width ?? null,
    height: asset.height ?? null,
  };
}

/** Фото из галереи. */
export async function pickPhoto(): Promise<PickedMedia | null> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
  if (res.canceled || !res.assets[0]) return null;
  return toPicked(res.assets[0], 'image');
}

/** Видео из галереи. */
export async function pickVideo(): Promise<PickedMedia | null> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'] });
  if (res.canceled || !res.assets[0]) return null;
  return toPicked(res.assets[0], 'video');
}

/** Видеокружок: запись на фронтальную камеру до 60 секунд (в вебе выбор файла). */
export async function recordCircle(): Promise<PickedMedia | null> {
  if (Platform.OS === 'web') {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'] });
    if (res.canceled || !res.assets[0]) return null;
    return toPicked(res.assets[0], 'video_circle');
  }
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new Error('Разреши доступ к камере в настройках телефона');
  const res = await ImagePicker.launchCameraAsync({
    mediaTypes: ['videos'],
    cameraType: ImagePicker.CameraType.front,
    videoMaxDuration: MAX_CIRCLE_SECONDS,
  });
  if (res.canceled || !res.assets[0]) return null;
  return toPicked(res.assets[0], 'video_circle');
}

/** Загружает файл в закрытое хранилище и возвращает путь `<chat_id>/<имя>`. */
export async function uploadMedia(chatId: string, media: PickedMedia): Promise<string> {
  const sub = media.mimeType.split('/')[1]?.split(';')[0] ?? 'bin';
  const ext = sub === 'quicktime' ? 'mov' : sub;
  const path = `${chatId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

  const response = await fetch(media.uri);
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error('Файл больше 50 МБ. Выбери файл поменьше.');
  }

  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, buffer, { contentType: media.mimeType });
  if (error) throw error;
  return path;
}
