import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const word = searchParams.get('word');

  if (!word) {
    return NextResponse.json({ error: 'Search word is required' }, { status: 400 });
  }

  const apiKey = process.env.RAPIDAPI_KEY;
  const apiHost = process.env.RAPIDAPI_HOST;

  if (!apiKey || !apiHost) {
    return NextResponse.json({ error: 'API key is not configured' }, { status: 500 });
  }

  try {
    const navitimeUrl = new URL(`https://${apiHost}/transport_node`);
    navitimeUrl.searchParams.append('word', word);
    navitimeUrl.searchParams.append('coord_unit', 'degree');
    navitimeUrl.searchParams.append('datum', 'wgs84');
    navitimeUrl.searchParams.append('limit', '10');

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
      
      let errorMessage = 'Failed to fetch from NAVITIME API';
      try {
        const errJson = JSON.parse(errorText);
        if (errJson.message) errorMessage = errJson.message;
      } catch (e) {}

      return NextResponse.json({ error: errorMessage }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching nodes:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
