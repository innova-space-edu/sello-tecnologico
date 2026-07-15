export type FeedPost = {
  item_type: 'asset' | 'block'
  item_id: string
  item_key: string
  page_id: string
  page_slug: string
  page_title: string
  page_description?: string | null
  author_name?: string | null
  project_id?: string | null
  project_title?: string | null
  course_id?: string | null
  course_name?: string | null
  title?: string | null
  content?: string | null
  media_type: string
  block_type?: string | null
  asset_id?: string | null
  published_at: string
  theme_color?: string | null
  accent_color?: string | null
  background_color?: string | null
  text_color?: string | null
  card_color?: string | null
  likes_count: number
  comments_count: number
  views_count: number
  trend_score: number
}

export type FeedCursor = {
  itemKey: string
  publishedAt: string
  trendScore: number
}

export type FeedResponse = {
  posts: FeedPost[]
  nextCursor: string | null
  hasMore: boolean
}

export type TrendingPage = {
  id: string
  title: string
  slug: string
  description?: string | null
  theme_color?: string | null
  accent_color?: string | null
  likes_count: number
  views_count: number
  comments_count: number
  trend_score: number
}
