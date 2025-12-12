/**
 * Types de base pour l'intégration Bluesky
 */

export interface BlueskyCredentials {
  identifier: string;
  password: string;
}

export interface BlueskySession {
  did: string;
  handle: string;
  accessJwt: string;
  refreshJwt: string;
}

export interface BlueskyProfile {
  did: string;
  handle: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  banner?: string;
  followersCount: number;
  followsCount: number;
  postsCount: number;
  indexedAt?: string;
  viewer?: {
    muted?: boolean;
    blockedBy?: boolean;
    blocking?: string;
    following?: string;
    followedBy?: string;
  };
}

export interface BlueskyPost {
  uri: string;
  cid: string;
  author: BlueskyProfile;
  record: PostRecord;
  replyCount: number;
  repostCount: number;
  likeCount: number;
  indexedAt: string;
  embed?: PostEmbed;
  labels?: Label[];
}

export interface PostRecord {
  $type: string;
  text: string;
  createdAt: string;
  langs?: string[];
  facets?: Facet[];
  reply?: ReplyRef;
  embed?: EmbedRecord;
}

export interface Facet {
  index: ByteSlice;
  features: FacetFeature[];
}

export interface ByteSlice {
  byteStart: number;
  byteEnd: number;
}

export type FacetFeature = MentionFeature | LinkFeature | TagFeature;

export interface MentionFeature {
  $type: 'app.bsky.richtext.facet#mention';
  did: string;
}

export interface LinkFeature {
  $type: 'app.bsky.richtext.facet#link';
  uri: string;
}

export interface TagFeature {
  $type: 'app.bsky.richtext.facet#tag';
  tag: string;
}

export interface ReplyRef {
  root: PostRef;
  parent: PostRef;
}

export interface PostRef {
  uri: string;
  cid: string;
}

export interface EmbedRecord {
  $type: string;
  [key: string]: unknown;
}

export interface PostEmbed {
  $type: string;
  images?: EmbedImage[];
  external?: EmbedExternal;
  record?: EmbedRecordView;
}

export interface EmbedImage {
  thumb: string;
  fullsize: string;
  alt: string;
  aspectRatio?: AspectRatio;
}

export interface AspectRatio {
  width: number;
  height: number;
}

export interface EmbedExternal {
  uri: string;
  title: string;
  description: string;
  thumb?: string;
}

export interface EmbedRecordView {
  uri: string;
  cid: string;
  author: BlueskyProfile;
  value: PostRecord;
  indexedAt: string;
}

export interface Label {
  src: string;
  uri: string;
  val: string;
  cts: string;
}

export interface Feed {
  feed: FeedViewPost[];
  cursor?: string;
}

export interface FeedViewPost {
  post: BlueskyPost;
  reply?: ReplyContext;
  reason?: FeedReason;
}

export interface ReplyContext {
  root: BlueskyPost;
  parent: BlueskyPost;
}

export interface FeedReason {
  $type: string;
  by: BlueskyProfile;
  indexedAt: string;
}

export interface Notification {
  uri: string;
  cid: string;
  author: BlueskyProfile;
  reason: NotificationReason;
  reasonSubject?: string;
  record: unknown;
  isRead: boolean;
  indexedAt: string;
}

export type NotificationReason = 
  | 'like'
  | 'repost'
  | 'follow'
  | 'mention'
  | 'reply'
  | 'quote';

export interface Thread {
  post: BlueskyPost;
  parent?: ThreadParent;
  replies?: ThreadReply[];
}

export type ThreadParent = Thread | NotFoundPost | BlockedPost;
export type ThreadReply = Thread | NotFoundPost | BlockedPost;

export interface NotFoundPost {
  $type: 'app.bsky.feed.defs#notFoundPost';
  uri: string;
  notFound: true;
}

export interface BlockedPost {
  $type: 'app.bsky.feed.defs#blockedPost';
  uri: string;
  blocked: true;
}
