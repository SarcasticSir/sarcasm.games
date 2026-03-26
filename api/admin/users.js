const { requireSession } = require('../_lib/auth');
const { listProfiles } = require('../_lib/db');

function readString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function maskEmail(email) {
  const safeEmail = readString(email);
  if (!safeEmail) return '***';

  const [localPartRaw = '', domainRaw = ''] = safeEmail.split('@');
  const localPart = String(localPartRaw);
  const domain = readString(domainRaw);

  if (!domain) return '***';

  const localPrefix = localPart.length >= 2
    ? localPart.slice(0, 2)
    : localPart.length === 1
      ? localPart.slice(0, 1)
      : '';

  if (!localPrefix) {
    return `***@${domain}`;
  }

  return `${localPrefix}***@${domain}`;
}

function mapMember(profile) {
  return {
    id: profile.auth_user_id,
    username: readString(profile.username) || 'user',
    email: maskEmail(profile.email),
    role: readString(profile.role) || 'user',
    country: readString(profile.country) || 'unknown'
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const session = await requireSession(req, res);
  if (!session) return;

  if (session.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  try {
    const users = await listProfiles({
      country: readString(req.query?.country),
      username: readString(req.query?.username),
      email: readString(req.query?.email)
    });
    res.status(200).json({ users: users.map(mapMember) });
  } catch (error) {
    console.error('[admin/users] Failed to load members:', error?.message);
    res.status(500).json({ error: 'Failed to load users' });
  }
};
