import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, ErrorText } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import {
  type Call,
  getCall,
  getCallToken,
  setCallStatus,
  subscribeToCall,
} from '../../lib/calls';
import { colors } from '../../lib/theme';

// Нативный модуль LiveKit есть только в собранном приложении (не в Expo Go)
type LK = typeof import('@livekit/react-native');
let lk: LK | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  lk = require('@livekit/react-native') as LK;
} catch {
  lk = null;
}

function Room({ video, onEnd }: { video: boolean; onEnd: () => void }) {
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(!video);
  if (!lk) return null;
  const { useTracks, VideoTrack, isTrackReference, useRoomContext } = lk as any;
  const { Track } = require('livekit-client');
  const room = useRoomContext();
  const tracks = useTracks([Track.Source.Camera]).filter((t: any) => isTrackReference(t));
  const remote = tracks.find((t: any) => !t.participant.isLocal);
  const local = tracks.find((t: any) => t.participant.isLocal);

  return (
    <View style={styles.full}>
      {remote ? (
        <VideoTrack trackRef={remote} style={styles.full} objectFit="cover" />
      ) : (
        <View style={[styles.full, styles.center]}>
          <Text style={styles.name}>Соединено</Text>
        </View>
      )}
      {local && !camOff && <VideoTrack trackRef={local} style={styles.pip} objectFit="cover" mirror />}
      <View style={styles.bar}>
        <Pressable
          style={[styles.round, muted && styles.roundOn]}
          onPress={() => {
            room.localParticipant.setMicrophoneEnabled(muted);
            setMuted(!muted);
          }}
        >
          <Text style={styles.roundText}>{muted ? 'Звук выкл' : 'Микрофон'}</Text>
        </Pressable>
        <Pressable
          style={[styles.round, camOff && styles.roundOn]}
          onPress={() => {
            room.localParticipant.setCameraEnabled(camOff);
            setCamOff(!camOff);
          }}
        >
          <Text style={styles.roundText}>{camOff ? 'Камера выкл' : 'Камера'}</Text>
        </Pressable>
        <Pressable style={[styles.round, styles.end]} onPress={onEnd}>
          <Text style={styles.roundText}>Завершить</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function CallScreen() {
  const { id, incoming } = useLocalSearchParams<{ id: string; incoming?: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const me = session?.user.id ?? '';
  const [call, setCall] = useState<Call | null>(null);
  const [conn, setConn] = useState<{ url: string; token: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isCallee = !!call && call.callee_id === me;

  useEffect(() => {
    if (!id) return;
    getCall(id).then(setCall).catch((e: Error) => setError(e.message));
    return subscribeToCall(id, setCall);
  }, [id]);

  // Исходящий: ждём ответа до 45 секунд
  useEffect(() => {
    if (!call || call.caller_id !== me || call.status !== 'ringing') return;
    const t = setTimeout(() => void setCallStatus(call.id, 'missed').catch(() => {}), 45_000);
    return () => clearTimeout(t);
  }, [call, me]);

  // Подключаемся, когда звонок принят
  useEffect(() => {
    if (call?.status !== 'accepted' || conn || !id) return;
    getCallToken(id).then(setConn).catch((e: Error) => setError(e.message));
  }, [call?.status, conn, id]);

  const finished = call && ['declined', 'ended', 'missed'].includes(call.status);
  useEffect(() => {
    if (!finished) return;
    const t = setTimeout(() => router.back(), 1200);
    return () => clearTimeout(t);
  }, [finished, router]);

  async function hangup() {
    if (id) await setCallStatus(id, call?.status === 'ringing' && isCallee ? 'declined' : 'ended').catch(() => {});
    router.back();
  }

  if (!lk) {
    return (
      <View style={[styles.full, styles.center]}>
        <Text style={styles.name}>Звонки работают только в установленном приложении Трио (не в Expo Go).</Text>
        <Button title="Назад" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  if (conn && call?.status === 'accepted') {
    const { LiveKitRoom, AudioSession } = lk as any;
    return (
      <LiveKitRoom
        serverUrl={conn.url}
        token={conn.token}
        connect
        audio
        video={call.kind === 'video'}
        onConnected={() => void AudioSession?.startAudioSession?.()}
        onDisconnected={() => void AudioSession?.stopAudioSession?.()}
        onError={(e: Error) => setError(e.message)}
      >
        <Room video={call.kind === 'video'} onEnd={hangup} />
      </LiveKitRoom>
    );
  }

  const label = !call
    ? 'Загрузка…'
    : finished
      ? call.status === 'declined' ? 'Звонок отклонён' : call.status === 'missed' ? 'Нет ответа' : 'Звонок завершён'
      : call.status === 'accepted' ? 'Соединение…'
      : isCallee ? (call.kind === 'video' ? 'Входящий видеозвонок' : 'Входящий звонок')
      : 'Вызов…';

  return (
    <View style={[styles.full, styles.center]}>
      <Text style={styles.name}>{label}</Text>
      {call && !finished && call.status === 'ringing' && !isCallee && <ActivityIndicator color={colors.primary} />}
      <ErrorText>{error}</ErrorText>
      {call && isCallee && call.status === 'ringing' && (
        <View style={styles.bar}>
          <Pressable style={[styles.round, styles.end]} onPress={hangup}>
            <Text style={styles.roundText}>Отклонить</Text>
          </Pressable>
          <Pressable style={[styles.round, styles.ok]} onPress={() => void setCallStatus(call.id, 'accepted')}>
            <Text style={styles.roundText}>Ответить</Text>
          </Pressable>
        </View>
      )}
      {call && !isCallee && !finished && (
        <View style={styles.bar}>
          <Pressable style={[styles.round, styles.end]} onPress={hangup}>
            <Text style={styles.roundText}>Отменить</Text>
          </Pressable>
        </View>
      )}
      {incoming ? null : null}
    </View>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24 },
  name: { color: colors.text, fontSize: 22, fontWeight: '600', textAlign: 'center' },
  pip: { position: 'absolute', top: 56, right: 16, width: 110, height: 150, borderRadius: 14, overflow: 'hidden' },
  bar: { position: 'absolute', bottom: 48, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 14 },
  round: { minWidth: 92, paddingVertical: 16, paddingHorizontal: 14, borderRadius: 32, backgroundColor: colors.card, alignItems: 'center' },
  roundOn: { backgroundColor: colors.border },
  roundText: { color: colors.text, fontWeight: '600' },
  end: { backgroundColor: colors.danger },
  ok: { backgroundColor: '#22C55E' },
});
