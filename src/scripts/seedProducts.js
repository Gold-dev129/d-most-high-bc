import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Product from '../models/Product.js';

dotenv.config();

const sampleProducts = [
  {
    name: 'DMOSTHIGH Oversized Heavyweight Tee',
    description: '300 GSM luxury combed cotton with custom relaxed drop-shoulder silhouette. Features signature DMOSTHIGH rubberized branding on chest and large typography archive print across back. Preshrunk and garment-dyed for ultra-soft hand feel.',
    category: 'tees',
    price: 45000,
    discountPrice: 35000,
    stock: 50,
    sizes: ['S', 'M', 'L', 'XL'],
    colors: ['Black', 'Yellow'],
    featured: true,
    active: true,
    images: [
      {
        url: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=900&auto=format&fit=crop&q=80',
        public_id: 'sample_tee_black',
        color: 'Black',
      },
      {
        url: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=900&auto=format&fit=crop&q=80',
        public_id: 'sample_tee_yellow',
        color: 'Yellow',
      },
    ],
  },
  {
    name: 'DMOSTHIGH Raw-Fleece Cyber Hoodie',
    description: '450 GSM double-layered French terry cotton. Double-stitched seams with heavy-duty ribbed cuffs and hem. Minimalist tonal chest embroidery and oversized hood without drawstrings for a clean contemporary drape.',
    category: 'hoodies',
    price: 85000,
    discountPrice: 70000,
    stock: 35,
    sizes: ['M', 'L', 'XL', 'XXL'],
    colors: ['Black', 'Yellow'],
    featured: true,
    active: true,
    images: [
      {
        url: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=900&auto=format&fit=crop&q=80',
        public_id: 'sample_hoodie_black',
        color: 'Black',
      },
      {
        url: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=900&auto=format&fit=crop&q=80',
        public_id: 'sample_hoodie_yellow',
        color: 'Yellow',
      },
    ],
  },
  {
    name: 'DMOSTHIGH Wide-Leg Street Sweatpants',
    description: 'Heavyweight loopback cotton designed with wide relaxed leg, deep cargo pockets, concealed drawstrings, and raw edge hems. Finished with custom tonal DMOSTHIGH hardware.',
    category: 'sweatpants',
    price: 60000,
    discountPrice: null,
    stock: 40,
    sizes: ['S', 'M', 'L', 'XL'],
    colors: ['Black', 'Yellow'],
    featured: true,
    active: true,
    images: [
      {
        url: 'https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=900&auto=format&fit=crop&q=80',
        public_id: 'sample_pants_black',
        color: 'Black',
      },
      {
        url: 'https://images.unsplash.com/photo-1517445312882-bc9910d016b7?w=900&auto=format&fit=crop&q=80',
        public_id: 'sample_pants_yellow',
        color: 'Yellow',
      },
    ],
  },
  {
    name: 'DMOSTHIGH Tactical Trucker Cap',
    description: 'Structured 6-panel trucker cap featuring high-density 3D rubber logo on front, premium breathable mesh back, and custom adjustable snap closure.',
    category: 'headwear',
    price: 25000,
    discountPrice: 20000,
    stock: 60,
    sizes: ['Standard'],
    colors: ['Black', 'Yellow'],
    featured: false,
    active: true,
    images: [
      {
        url: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=900&auto=format&fit=crop&q=80',
        public_id: 'sample_cap_black',
        color: 'Black',
      },
      {
        url: 'https://images.unsplash.com/photo-1575428652377-a2d80e2277fc?w=900&auto=format&fit=crop&q=80',
        public_id: 'sample_cap_yellow',
        color: 'Yellow',
      },
    ],
  },
];

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB for seeding products...');

    const count = await Product.countDocuments();
    if (count > 0) {
      console.log(`DB already has ${count} products. Skipping duplicate seed.`);
      process.exit(0);
    }

    for (const prodData of sampleProducts) {
      const p = new Product(prodData);
      await p.save();
      console.log(`Created product: ${p.name} (${p.colors.join('/')})`);
    }

    console.log('Seeding completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
};

seed();
