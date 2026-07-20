const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { logActivity } = require('../utils/activityLogger');

const getRepositories = async (req, res) => {
  try {
    const repos = await prisma.repository.findMany({
      include: { branches: { orderBy: { name: 'asc' } } },
      orderBy: { name: 'asc' }
    });
    res.json(repos);
  } catch (error) {
    console.error('Get repositories error:', error);
    res.status(500).json({ message: 'Failed to retrieve git repositories.' });
  }
};

const createRepository = async (req, res) => {
  try {
    const { name, url, lang } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Repository name is required.' });
    }

    // Check unique
    const existing = await prisma.repository.findUnique({
      where: { name }
    });
    if (existing) {
      return res.status(400).json({ message: 'A repository with this name is already registered.' });
    }

    const newRepo = await prisma.repository.create({
      data: {
        name,
        url: url || null,
        lang: lang || 'React/JS',
        status: 'Passing',
        commitsCount: Math.floor(Math.random() * 50) + 10,
        branches: {
          create: [
            { name: 'main', url: url ? `${url}/tree/main` : null, isDefault: true },
            { name: 'develop', url: url ? `${url}/tree/develop` : null }
          ]
        }
      },
      include: { branches: true }
    });

    await logActivity({
      userId: req.user.id,
      action: 'REPO_CREATE',
      details: `Registered repository: ${name}`
    });

    res.status(201).json(newRepo);
  } catch (error) {
    console.error('Create repository error:', error);
    res.status(500).json({ message: 'Failed to register git repository.' });
  }
};

const deleteRepository = async (req, res) => {
  try {
    const { id } = req.params;

    const repo = await prisma.repository.findUnique({
      where: { id }
    });
    if (!repo) {
      return res.status(404).json({ message: 'Repository not found.' });
    }

    await prisma.repository.delete({
      where: { id }
    });

    await logActivity({
      userId: req.user.id,
      action: 'REPO_DELETE',
      details: `Deleted repository: ${repo.name}`
    });

    res.json({ message: 'Repository deleted successfully.' });
  } catch (error) {
    console.error('Delete repository error:', error);
    res.status(500).json({ message: 'Failed to delete repository.' });
  }
};

const createBranch = async (req, res) => {
  try {
    const { repoId } = req.params;
    const { name, url } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Branch name is required.' });
    }

    const repo = await prisma.repository.findUnique({
      where: { id: repoId }
    });

    if (!repo) {
      return res.status(404).json({ message: 'Repository not found.' });
    }

    const existingBranch = await prisma.branch.findUnique({
      where: {
        repoId_name: {
          repoId,
          name
        }
      }
    });

    if (existingBranch) {
      return res.status(400).json({ message: 'Branch with this name already exists in this repository.' });
    }

    const branch = await prisma.branch.create({
      data: {
        repoId,
        name,
        url: url || (repo.url ? `${repo.url}/tree/${name}` : null)
      }
    });

    await logActivity({
      userId: req.user.id,
      action: 'BRANCH_CREATE',
      details: `Created branch ${name} in repository ${repo.name}`
    });

    res.status(201).json(branch);
  } catch (error) {
    console.error('Create branch error:', error);
    res.status(500).json({ message: 'Failed to create repository branch.' });
  }
};

const deleteBranch = async (req, res) => {
  try {
    const { branchId } = req.params;

    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      include: { repository: true }
    });

    if (!branch) {
      return res.status(404).json({ message: 'Branch not found.' });
    }

    if (branch.isDefault) {
      return res.status(400).json({ message: 'Cannot delete the default branch.' });
    }

    await prisma.branch.delete({
      where: { id: branchId }
    });

    await logActivity({
      userId: req.user.id,
      action: 'BRANCH_DELETE',
      details: `Deleted branch ${branch.name} from repository ${branch.repository.name}`
    });

    res.json({ message: 'Branch deleted successfully.' });
  } catch (error) {
    console.error('Delete branch error:', error);
    res.status(500).json({ message: 'Failed to delete branch.' });
  }
};

module.exports = {
  getRepositories,
  createRepository,
  deleteRepository,
  createBranch,
  deleteBranch
};
