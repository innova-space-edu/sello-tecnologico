export type StoryReactionEmoji = '❤️' | '👏' | '🔥' | '🌱' | '💡' | '🚀' | '😂' | '😮'

export type StoryItem = {
  id: string
  media_type: 'image' | 'video'
  file_name: string
  mime_type?: string | null
  file_size?: number | null
  width?: number | null
  height?: number | null
  duration_seconds?: number | null
  sort_order: number
  signed_url: string
}

export type StoryComment = {
  id: string
  content: string
  visitor_name?: string | null
  author_name: string
  created_at: string
}

export type CommunityStory = {
  id: string
  title?: string | null
  caption?: string | null
  author_id: string
  author_name: string
  project_id?: string | null
  project_title?: string | null
  page_id?: string | null
  page_title?: string | null
  course_id?: string | null
  course_name?: string | null
  visibility_status: 'published' | 'hidden' | 'deleted' | 'expired'
  review_status: 'pending' | 'reviewed' | 'flagged' | 'correction_requested'
  is_featured: boolean
  comments_enabled: boolean
  expires_at: string
  published_at: string
  items: StoryItem[]
  reactions: Record<StoryReactionEmoji, number>
  reactions_count: number
  comments_count: number
  views_count: number
  viewer_reaction?: StoryReactionEmoji | null
  comments: StoryComment[]
}

export type StoriesResponse = {
  stories: CommunityStory[]
}
