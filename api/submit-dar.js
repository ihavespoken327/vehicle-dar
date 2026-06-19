// api/submit-dar.js

export default async function handler(req, res) {
  // 1. Only allow POST requests (form submissions)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 2. Grab the log data sent from your frontend
  const { officerName, shift, station, apparatus, status, notes, htmlMarkup } = req.body;

  try {
    // 3. Fire off the email using Resend's API
    // We fetch directly from Resend's endpoint so we don't have to install heavy npm packages
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'MFD Logs <onboarding@resend.dev>', // Resend's default free testing email
        to: ['1madff72@gmail.com'], // Put your email here to test it first!
        subject: `🚨 DAR Submitted: ${station} - ${apparatus} (${status})`,
        html: htmlMarkup // This is the beautiful HTML table your frontend generates
      })
    });

    const emailData = await emailResponse.json();

    if (!emailResponse.ok) {
      throw new Error(emailData.message || 'Failed to send email');
    }

    // 4. If everything worked, tell the frontend "Success!"
    return res.status(200).json({ success: true, message: 'Log submitted and email sent!' });

  } catch (error) {
    console.error('Backend Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}