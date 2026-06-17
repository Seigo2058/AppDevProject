import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const goal = searchParams.get('goal');
  const startTime = searchParams.get('start_time');

  if (!start || !goal) {
    return NextResponse.json({ error: 'Start and goal nodes are required' }, { status: 400 });
  }

  const apiKey = process.env.RAPIDAPI_KEY;
  // RapidAPIの「ルート検索(トータルナビ)」APIはホスト名が異なるため上書き
  const apiHost = 'navitime-route-totalnavi.p.rapidapi.com';

  if (!apiKey) {
    return NextResponse.json({ error: 'API key is not configured' }, { status: 500 });
  }

  try {
    const navitimeUrl = new URL(`https://${apiHost}/route_transit`);
    navitimeUrl.searchParams.append('start', start);
    navitimeUrl.searchParams.append('goal', goal);
    
    if (startTime) {
      navitimeUrl.searchParams.append('start_time', startTime);
    } else {
      // APIは start_time、goal_time、first_operation、または last_operation を必要とします
      // デフォルトは YYYY-MM-DDThh:mm:ss 形式の現在時刻とします
      const now = new Date();
      // ミリ秒とZを除いたローカル時間のISO文字列にフォーマットします
      const formattedTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .split('.')[0];
      navitimeUrl.searchParams.append('start_time', formattedTime);
    }

    const response = await fetch(navitimeUrl.toString(), {
      method: 'GET',
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': apiHost,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('NAVITIME API Error:', response.status, errorText);
      
      let errorMessage = 'Failed to fetch route from NAVITIME API';
      try {
        const errJson = JSON.parse(errorText);
        if (errJson.message) errorMessage = errJson.message;
      } catch (e) {}

      return NextResponse.json({ error: errorMessage }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching route:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
