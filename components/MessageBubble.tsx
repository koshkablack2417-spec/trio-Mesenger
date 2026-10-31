import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { type Message, getSignedUrl, readContactMeta } from '../lib/chats';
import { colors } from '../lib/theme';

function useSignedUrl(path: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!path) {
      setUrl(null);
      return;
    }
    getSignedUrl(path)
      .then((u) => {
        if (alive) setUrl(u);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [path]);
  return url;
}

function ImageMessage({ path }: { path: string | null }) {
  const url = useSignedUrl(path);
  if (!url) return <View style={[styles.image, styles.placeholder]} />;
  return <Image source={{ uri: url }} style={styles.image} resizeMode="cover" />;
}

function VideoMessage({ path }: { path: string | null }) {
  const url = useSignedUrl(path);
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
  });
  if (!url) return <View style={[styles.video, styles.placeholder]} />;
  return <VideoView player={player} style={styles.video} nativeControls contentFit="contain" />;
}

/** Видеокружок: круглое видео, нажми, чтобы включить или поставить на паузу. */
function CircleMessage({ path }: { path: string | null }) {
  const url = useSignedUrl(path);
  const player = useVideoPlayer(url, (p) => {
    p.loop = true;
  });
  const [playing, setPlaying] = useState(false);

  if (!url) return <View style={[styles.circle, styles.placeholder]} />;

  function toggle() {
    if (playing) {
      player.pause();
      setPlaying(false);
    } else {
      player.play();
      setPlaying(true);
    }
  }

  return (
    <Pressable onPress={toggle} style={styles.circle}>
      <VideoView
        player={player}
        style={styles.circleVideo}
        nativeControls={false}
        contentFit="cover"
      />
      {!playing && (
        <View style={styles.playBadge}>
          <Text style={styles.playText}>▶</Text>
        </View>
      )}
    </Pressable>
  );
}

function ContactMessage({ meta }: { meta: Record<string, unknown> | null }) {
  const contact = readContactMeta(meta);
  if (!contact) return <Text style={styles.text}>[контакт]</Text>;
  return (
    <View style={{ gap: 2 }}>
      <Text style={styles.contactName}>👤 {contact.name}</Text>
      {contact.phones.map((phone) => (
        <Text key={phone} style={styles.text}>
          {phone}
        </Text>
      ))}
    </View>
  );
}

export function MessageBubble({ message, mine }: { message: Message; mine: boolean }) {
  const isCircle = message.kind === 'video_circle';

  let content: React.ReactNode;
  switch (message.kind) {
    case 'image':
      content = <ImageMessage path={message.media_path} />;
      break;
    case 'video':
      content = <VideoMessage path={message.media_path} />;
      break;
    case 'video_circle':
      content = <CircleMessage path={message.media_path} />;
      break;
    case 'contact':
      content = <ContactMessage meta={message.meta} />;
      break;
    case 'text':
      content = <Text style={styles.text}>{message.body}</Text>;
      break;
    default:
      content = <Text style={styles.text}>[{message.kind}]</Text>;
  }

  // У кружка нет «пузыря»: видно только круг.
  if (isCircle) {
    return <View style={[styles.circleWrap, mine ? styles.mineAlign : styles.otherAlign]}>{content}</View>;
  }

  return (
    <View style={[styles.bubble, mine ? styles.mine : styles.other]}>{content}</View>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: '80%', borderRadius: 16, padding: 8 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.bubbleMine },
  other: { alignSelf: 'flex-start', backgroundColor: colors.bubbleOther },
  mineAlign: { alignSelf: 'flex-end' },
  otherAlign: { alignSelf: 'flex-start' },
  text: { color: colors.text, fontSize: 16, paddingHorizontal: 6, paddingVertical: 2 },
  contactName: { color: colors.text, fontSize: 16, fontWeight: '600', paddingHorizontal: 6 },
  image: { width: 240, height: 240, borderRadius: 12 },
  video: { width: 260, height: 200, borderRadius: 12, backgroundColor: '#000' },
  placeholder: { backgroundColor: colors.card },
  circleWrap: { padding: 2 },
  circle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  circleVideo: { width: 200, height: 200 },
  playBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  playText: { color: '#fff', fontSize: 36 },
});
