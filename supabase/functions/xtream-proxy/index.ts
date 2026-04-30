import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url, username, password, action, ...params } = await req.json()

    if (!url || !username || !password) {
      return new Response(JSON.stringify({ error: 'Missing parameters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const searchParams = new URLSearchParams({
      username,
      password,
      action: action || '',
      ...params,
    })

    // Use https if available or allow the original protocol
    const targetUrl = `${url}/player_api.php?${searchParams.toString()}`
    console.log('Proxying request to:', targetUrl)

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': '*/*',
        'Connection': 'keep-alive'
      }
    })

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Remote server error:', response.status, errorText);
      return new Response(JSON.stringify({ error: `Remote server responded with ${response.status}` }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const text = await response.text();
    try {
      // Some IPTV servers return BOM or extra characters, trim the text
      const cleanText = text.trim();
      const data = JSON.parse(cleanText);
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } catch (parseError) {
      console.error('Failed to parse JSON response. First 100 chars:', text.substring(0, 100));
      // If it's not JSON, it might be an error message in plain text or HTML
      return new Response(JSON.stringify({ 
        error: 'Invalid response format from IPTV server',
        details: text.substring(0, 200) 
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  } catch (error) {
    console.error('Proxy error:', error)
    return new Response(JSON.stringify({ error: 'Connection failed', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})