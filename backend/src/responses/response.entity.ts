import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Form } from '../forms/form.entity';

@Entity('responses')
export class Response {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  formId: string | null;

  @ManyToOne(() => Form, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'formId' })
  form: Form | null;

  @Column({ type: 'jsonb' })
  data: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}
