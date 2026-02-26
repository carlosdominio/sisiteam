require('dotenv').config();
const express = require('express');
const path = require('path');
const XLSX = require('xlsx');
const { 
  generateAlias,
  getDailyUsageCount, 
  incrementDailyUsage, 
  getAllUsedEmails,
  logAlias, 
  markAliasAsUsed,
  getTodayAliases, 
  getAllAliases,
  getExpiredAliases,
  getDailyUsageStats,
  getAliasById,
  deleteAlias,
  clearUsedEmails,
  resetDailyUsage,
  updateAlias,
  updateAliasColor
} = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

const DAILY_LIMIT = parseInt(process.env.DAILY_LIMIT) || 5;
const PRIMARY_EMAIL = process.env.PRIMARY_EMAIL || 'usuario@outlook.com';
const ALIAS_DOMAIN = process.env.ALIAS_DOMAIN || 'outlook.com';
const DEFAULT_VALIDITY_DAYS = parseInt(process.env.DEFAULT_VALIDITY_DAYS) || 3;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.get('/api/status', (req, res) => {
  const userEmail = PRIMARY_EMAIL;
  const usageCount = getDailyUsageCount(userEmail);
  const todayAliases = getTodayAliases(userEmail);
  const stats = getDailyUsageStats();
  const usedEmails = getAllUsedEmails();
  const expiredAliases = getExpiredAliases();

  res.json({
    primary: PRIMARY_EMAIL,
    dailyUsage: {
      used: usageCount,
      limit: DAILY_LIMIT,
      remaining: DAILY_LIMIT - usageCount,
      percentage: Math.round((usageCount / DAILY_LIMIT) * 100)
    },
    todayAliases: todayAliases,
    usedEmails: usedEmails,
    expiredAliases: expiredAliases,
    stats: stats
  });
});

app.get('/api/aliases', (req, res) => {
  const userEmail = PRIMARY_EMAIL;
  const allAliases = getAllAliases();

  res.json({
    primary: PRIMARY_EMAIL,
    aliases: allAliases,
    dailyUsage: {
      used: getDailyUsageCount(userEmail),
      limit: DAILY_LIMIT,
      remaining: DAILY_LIMIT - getDailyUsageCount(userEmail)
    }
  });
});

app.post('/api/aliases', (req, res) => {
  const { project, description, usageLocation, validityDays } = req.body;
  
  if (!project) {
    return res.status(400).json({ error: 'Projeto obrigatório' });
  }

  const userEmail = PRIMARY_EMAIL;
  const usageCount = getDailyUsageCount(userEmail);

  if (usageCount >= DAILY_LIMIT) {
    return res.status(429).json({ 
      error: 'Limite diário atingido',
      used: usageCount,
      limit: DAILY_LIMIT
    });
  }

  const newAlias = generateAlias(project, ALIAS_DOMAIN);

  logAlias(
    newAlias, 
    PRIMARY_EMAIL, 
    description || '', 
    usageLocation || '',
    validityDays || DEFAULT_VALIDITY_DAYS,
    userEmail
  );
  
  incrementDailyUsage(userEmail);
  
  res.json({
    success: true,
    alias: newAlias,
    description: description || '',
    used: usageCount + 1,
    limit: DAILY_LIMIT
  });
});

app.post('/api/aliases/:id/usar', (req, res) => {
  const { id } = req.params;
  const { usageLocation } = req.body;
  
  if (!usageLocation) {
    return res.status(400).json({ error: 'Local de uso obrigatório' });
  }

  const alias = getAliasById(id);
  
  if (!alias) {
    return res.status(404).json({ error: 'Alias não encontrado' });
  }

  if (alias.used) {
    return res.status(400).json({ error: 'Alias já utilizado' });
  }

  markAliasAsUsed(id, usageLocation);
  
  res.json({ success: true, message: `Alias ${alias.alias} usado em ${usageLocation}` });
});

app.delete('/api/aliases/:id', (req, res) => {
  const { id } = req.params;
  const deleted = deleteAlias(id);
  
  if (deleted) {
    res.json({ success: true, message: 'Alias excluído' });
  } else {
    res.status(404).json({ error: 'Alias não encontrado' });
  }
});

app.put('/api/aliases/:id', (req, res) => {
  const { id } = req.params;
  const { description } = req.body;
  
  const alias = getAliasById(id);
  if (!alias) {
    return res.status(404).json({ error: 'Alias não encontrado' });
  }
  
  updateAlias(id, description);
  res.json({ success: true, message: 'Alias atualizado' });
});

app.patch('/api/aliases/:id/color', (req, res) => {
  const { id } = req.params;
  const { color } = req.body;
  
  const alias = getAliasById(id);
  if (!alias) {
    return res.status(404).json({ error: 'Alias não encontrado' });
  }
  
  updateAliasColor(id, color);
  res.json({ success: true, message: 'Cor atualizada' });
});

app.delete('/api/used-emails', (req, res) => {
  clearUsedEmails();
  res.json({ success: true, message: 'Emails limpos' });
});

app.delete('/api/daily-usage', (req, res) => {
  resetDailyUsage();
  res.json({ success: true, message: 'Limite resetado' });
});



app.listen(PORT, () => {
  console.log(`SISITEAM rodando em http://localhost:${PORT}`);
  console.log(`Email: ${PRIMARY_EMAIL} | Limite: ${DAILY_LIMIT}/dia`);
});
