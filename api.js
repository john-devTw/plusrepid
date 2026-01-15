const CONFIG = window.REPID_CONFIG || { 
  SUPABASE_URL: 'YOUR_SUPABASE_URL', 
  SUPABASE_ANON_KEY: 'YOUR_SUPABASE_ANON_KEY' 
};

class RepidAPI {
  constructor() {
    this.baseUrl = CONFIG.SUPABASE_URL;
    this.apiKey = CONFIG.SUPABASE_ANON_KEY;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}/rest/v1/${endpoint}`;
    
    const headers = {
      'apikey': this.apiKey,
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'Prefer': options.prefer || 'return=representation'
    };

    if (options.range) {
      headers['Range-Unit'] = 'items';
      headers['Range'] = options.range;
    }

    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  async upsertUser(address) {
    const data = await this.request('users', {
      method: 'POST',
      body: { address: address.toLowerCase() },
      prefer: 'return=representation,resolution=merge-duplicates'
    });
    return data[0];
  }

  async getUser(address) {
    const data = await this.request(`users?address=eq.${address.toLowerCase()}`);
    return data[0] || null;
  }

  async createTag(tag) {
    await this.upsertUser(tag.author_address);

    const data = await this.request('tags?on_conflict=author_address,target_handle,target_platform', {
      method: 'POST',
      prefer: 'return=representation,resolution=merge-duplicates',
      body: {
        author_address: tag.author_address.toLowerCase(),
        target_handle: tag.target_handle.toLowerCase(),
        target_platform: tag.target_platform.toLowerCase(),
        tag_type: tag.tag_type,
        text: tag.text,
        network: tag.network || 'polygon',
        signature: tag.signature,
        message: tag.message
      }
    });
    return data[0];
  }

  async getTagsForProfile(platform, handle) {
    return await this.request(
      `tags?target_platform=eq.${platform.toLowerCase()}&target_handle=eq.${handle.toLowerCase()}&order=created_at.desc`
    );
  }

  async getTagsByUser(address) {
    return await this.request(
      `tags?author_address=eq.${address.toLowerCase()}&order=created_at.desc`
    );
  }

  async tagExists(authorAddress, platform, handle) {
    const data = await this.request(
      `tags?author_address=eq.${authorAddress.toLowerCase()}&target_platform=eq.${platform.toLowerCase()}&target_handle=eq.${handle.toLowerCase()}&select=id`
    );
    return data.length > 0;
  }

  async getProfile(platform, handle) {
    const id = `${platform.toLowerCase()}:${handle.toLowerCase()}`;
    const data = await this.request(`profiles?id=eq.${id}`);
    return data[0] || null;
  }

  async getTopProfiles(limit = 100) {
    return await this.request(`top_profiles?limit=${limit}`);
  }

  async searchProfiles(query, limit = 10) {
    return await this.request(
      `profiles?handle=ilike.*${query}*&order=reputation_score.desc&limit=${limit}`
    );
  }

  async getRecentTags(limit = 20) {
    return await this.request(`recent_tags?limit=${limit}`);
  }

  async getStats() {
    const [users, tags, profiles] = await Promise.all([
        fetch(`${this.baseUrl}/rest/v1/users?select=address`, { 
            method: 'HEAD', 
            headers: { 'apikey': this.apiKey, 'Prefer': 'count=exact' } 
        }),
        fetch(`${this.baseUrl}/rest/v1/tags?select=id`, { 
            method: 'HEAD', 
            headers: { 'apikey': this.apiKey, 'Prefer': 'count=exact' } 
        }),
        fetch(`${this.baseUrl}/rest/v1/profiles?select=id`, { 
            method: 'HEAD', 
            headers: { 'apikey': this.apiKey, 'Prefer': 'count=exact' } 
        })
    ]);

    const getCount = (res) => {
        const range = res.headers.get('content-range');
        return range ? parseInt(range.split('/')[1]) : 0;
    };

    return {
      totalUsers: getCount(users),
      totalTags: getCount(tags),
      totalProfiles: getCount(profiles)
    };
  }
}

const repidAPI = new RepidAPI();

if (typeof window !== 'undefined') {
  window.repidAPI = repidAPI;
}

if (typeof module !== 'undefined') {
  module.exports = { RepidAPI, repidAPI };
}