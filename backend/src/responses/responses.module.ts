import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Response } from './response.entity';
import { ResponsesService } from './responses.service';
import { ResponsesController } from './responses.controller';
import { FormsModule } from '../forms/forms.module';

@Module({
  imports: [TypeOrmModule.forFeature([Response]), FormsModule],
  controllers: [ResponsesController],
  providers: [ResponsesService],
})
export class ResponsesModule {}
