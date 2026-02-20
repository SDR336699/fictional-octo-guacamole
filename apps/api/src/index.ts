import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient, Language, ContractStatus } from '@prisma/client';
import { body, validationResult } from 'express-validator';
import { createWorker } from 'tesseract.js';
import Handlebars from 'handlebars';
import PDFDocument from 'pdfkit';

const app = express();
const prisma = new PrismaClient();
const upload = multer({ dest: 'uploads/' });
const port = process.env.PORT || 4000;
const jwtSecret = process.env.JWT_SECRET || 'rentpro-dev-secret';

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/contracts', express.static('contracts'));

const auth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ message: 'Token manquant' });
  }
  try {
    const payload = jwt.verify(token, jwtSecret) as { userId: string; agencyId: string };
    (req as any).user = payload;
    next();
  } catch {
    return res.status(401).json({ message: 'Token invalide' });
  }
};

app.get('/health', (_req, res) => res.json({ ok: true, app: 'Rent Pro API' }));

app.post('/auth/bootstrap', async (_req, res) => {
  const exists = await prisma.user.findFirst();
  if (exists) return res.status(400).json({ message: 'Bootstrap déjà effectué' });

  const agency = await prisma.agency.create({
    data: { name: 'Rent Pro Casablanca', city: 'Casablanca', currency: 'MAD' }
  });
  const password = await bcrypt.hash('Admin@123', 10);
  const user = await prisma.user.create({
    data: {
      email: 'admin@rentpro.ma',
      password,
      fullName: 'Administrateur Rent Pro',
      agencyId: agency.id
    }
  });
  res.json({ email: user.email, defaultPassword: 'Admin@123' });
});

app.post('/auth/login', [body('email').isEmail(), body('password').isString()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const user = await prisma.user.findUnique({ where: { email: req.body.email } });
  if (!user || !(await bcrypt.compare(req.body.password, user.password))) {
    return res.status(401).json({ message: 'Identifiants invalides' });
  }

  const token = jwt.sign({ userId: user.id, agencyId: user.agencyId }, jwtSecret, { expiresIn: '12h' });
  res.json({ token, profile: { fullName: user.fullName, email: user.email } });
});

app.get('/dashboard', auth, async (req, res) => {
  const agencyId = (req as any).user.agencyId;
  const [customers, vehicles, rentals, signedContracts] = await Promise.all([
    prisma.customer.count({ where: { agencyId } }),
    prisma.vehicle.count({ where: { agencyId } }),
    prisma.rental.count({ where: { agencyId } }),
    prisma.contract.count({ where: { rental: { agencyId }, status: ContractStatus.SIGNED } })
  ]);
  res.json({ customers, vehicles, rentals, signedContracts });
});

app.post('/customers', auth, upload.single('idScan'), async (req, res) => {
  const agencyId = (req as any).user.agencyId;
  let idScanText: string | undefined;

  if (req.file) {
    const worker = await createWorker('eng+ara+fra');
    const result = await worker.recognize(req.file.path);
    idScanText = result.data.text;
    await worker.terminate();
  }

  const customer = await prisma.customer.create({
    data: {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      nationalId: req.body.nationalId,
      phone: req.body.phone,
      email: req.body.email,
      city: req.body.city,
      preferredLang: (req.body.preferredLang as Language) || Language.FR,
      idScanPath: req.file?.path,
      idScanText,
      agencyId
    }
  });

  res.status(201).json(customer);
});

app.get('/customers', auth, async (req, res) => {
  const agencyId = (req as any).user.agencyId;
  const customers = await prisma.customer.findMany({ where: { agencyId }, orderBy: { createdAt: 'desc' } });
  res.json(customers);
});

app.post('/vehicles', auth, async (req, res) => {
  const agencyId = (req as any).user.agencyId;
  const vehicle = await prisma.vehicle.create({
    data: {
      registrationNo: req.body.registrationNo,
      brand: req.body.brand,
      model: req.body.model,
      dailyRate: req.body.dailyRate,
      agencyId
    }
  });
  res.status(201).json(vehicle);
});

app.get('/vehicles', auth, async (req, res) => {
  const agencyId = (req as any).user.agencyId;
  const vehicles = await prisma.vehicle.findMany({ where: { agencyId } });
  res.json(vehicles);
});

app.post('/rentals', auth, async (req, res) => {
  const agencyId = (req as any).user.agencyId;
  const rental = await prisma.rental.create({
    data: {
      startDate: new Date(req.body.startDate),
      endDate: new Date(req.body.endDate),
      pickupCity: req.body.pickupCity,
      dropoffCity: req.body.dropoffCity,
      totalMad: req.body.totalMad,
      customerId: req.body.customerId,
      vehicleId: req.body.vehicleId,
      agencyId
    },
    include: { customer: true, vehicle: true }
  });
  res.status(201).json(rental);
});

app.get('/rentals', auth, async (req, res) => {
  const agencyId = (req as any).user.agencyId;
  const rentals = await prisma.rental.findMany({ where: { agencyId }, include: { customer: true, vehicle: true, contract: true } });
  res.json(rentals);
});

const contractTemplate = Handlebars.compile(`
<h1>Contrat de Location - Rent Pro</h1>
<p>Client: {{customerName}} (CIN: {{nationalId}})</p>
<p>Véhicule: {{vehicle}}</p>
<p>Période: {{startDate}} → {{endDate}}</p>
<p>Retrait: {{pickupCity}} | Retour: {{dropoffCity}}</p>
<p>Total: {{totalMad}} MAD</p>
<p>Ce contrat est signé électroniquement conformément à la réglementation marocaine en vigueur.</p>
`);

app.post('/contracts/generate/:rentalId', auth, async (req, res) => {
  const rental = await prisma.rental.findUnique({
    where: { id: req.params.rentalId },
    include: { customer: true, vehicle: true, contract: true }
  });
  if (!rental) return res.status(404).json({ message: 'Location introuvable' });

  const htmlContent = contractTemplate({
    customerName: `${rental.customer.firstName} ${rental.customer.lastName}`,
    nationalId: rental.customer.nationalId,
    vehicle: `${rental.vehicle.brand} ${rental.vehicle.model} (${rental.vehicle.registrationNo})`,
    startDate: rental.startDate.toISOString().slice(0, 10),
    endDate: rental.endDate.toISOString().slice(0, 10),
    pickupCity: rental.pickupCity,
    dropoffCity: rental.dropoffCity,
    totalMad: rental.totalMad
  });

  const contractsDir = path.resolve('contracts');
  if (!fs.existsSync(contractsDir)) fs.mkdirSync(contractsDir, { recursive: true });
  const pdfPath = path.join(contractsDir, `${rental.id}.pdf`);

  const pdf = new PDFDocument();
  pdf.pipe(fs.createWriteStream(pdfPath));
  pdf.fontSize(12).text(htmlContent.replace(/<[^>]+>/g, ''), { width: 450 });
  pdf.end();

  const contract = await prisma.contract.upsert({
    where: { rentalId: rental.id },
    update: { htmlContent, pdfPath, status: ContractStatus.DRAFT },
    create: { rentalId: rental.id, htmlContent, pdfPath }
  });

  res.json(contract);
});

app.post('/contracts/:contractId/sign', auth, async (req, res) => {
  const contract = await prisma.contract.update({
    where: { id: req.params.contractId },
    data: { signatureData: req.body.signatureData, signedAt: new Date(), status: ContractStatus.SIGNED }
  });
  res.json(contract);
});

app.listen(port, () => {
  console.log(`Rent Pro API running on ${port}`);
});
